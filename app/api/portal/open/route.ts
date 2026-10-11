import { NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { isValidCpf, normalizeCpf } from "@/app/lib/cpf";
import {
  hashCpf,
  hashIp,
  hashToken,
  hmacEqual,
  isPortalConfigured,
  isTokenShaped,
} from "@/app/lib/portal/crypto";
import { decideOpen, GENERIC_DENIED } from "@/app/lib/portal/validate";
import { clientIp, createRateLimiter } from "@/app/lib/portal/rateLimit";
import {
  findPublicationByTokenHash,
  logPortalAccess,
  recordFailedAttempt,
  recordSuccessfulOpen,
} from "@/app/lib/portalDb";

export const runtime = "nodejs";

const limiter = createRateLimiter(15 * 60 * 1000, 20);

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!limiter.check(ip).allowed) {
    return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
  }
  if (!isPortalConfigured()) {
    return json({ error: "Portal indisponível no momento." }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: GENERIC_DENIED }, 400);
  }
  const token = (body as { token?: unknown } | null)?.token;
  const cpfRaw = (body as { cpf?: unknown } | null)?.cpf;
  if (!isTokenShaped(token) || typeof cpfRaw !== "string" || cpfRaw.length > 20) {
    return json({ error: GENERIC_DENIED }, 401);
  }
  const cpf = normalizeCpf(cpfRaw);
  if (!isValidCpf(cpf)) {
    return json({ error: GENERIC_DENIED }, 401);
  }

  try {
    const row = await findPublicationByTokenHash(hashToken(token));
    const cpfMatches = !!row && hmacEqual(hashCpf(cpf), row.cpfHmac);
    const decision = decideOpen(
      row
        ? {
            status: row.status,
            expiresAt: row.expiresAt,
            lockedUntil: row.lockedUntil,
            failedAttempts: row.failedAttempts,
            hasPayload: row.hasPayload,
            patientActive: row.patientActive,
          }
        : null,
      new Date(),
      cpfMatches
    );

    if (row && decision.kind !== "not_found") {
      const log = { publicationId: row.id, ipHmac: hashIp(ip), userAgent: request.headers.get("user-agent") || "" };
      if (decision.mutation === "increment") {
        await recordFailedAttempt(row.id, decision.lockedUntil ?? null, Boolean(decision.permanentLock));
        await logPortalAccess({ ...log, event: decision.permanentLock ? "locked" : "cpf_failed" });
      } else if (decision.mutation === "reset") {
        await recordSuccessfulOpen(row.id);
        await logPortalAccess({ ...log, event: "opened" });
      } else {
        await logPortalAccess({ ...log, event: `denied_${decision.kind}` });
      }
    }

    if (decision.kind !== "ok" || !row?.payload) {
      return json({ error: decision.message || GENERIC_DENIED, blocked: decision.http === 410 }, decision.http === 200 ? 410 : decision.http);
    }
    return json({ payload: row.payload }, 200);
  } catch (err) {
    logger.error("Portal open failed", { error: String(err) });
    return json({ error: "Não foi possível acessar agora. Tente novamente em instantes." }, 500);
  }
}
