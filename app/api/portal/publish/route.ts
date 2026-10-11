import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { parsePortalContent } from "@/app/lib/portal/schema";
import { encryptToken, hashCpf, hashToken, isPortalConfigured, newToken } from "@/app/lib/portal/crypto";
import {
  assemblePayload,
  deriveParts,
  expiryFrom,
  loadPublishContext,
  PortalPublishError,
  validateContent,
} from "@/app/lib/portal/assemble";
import { createPublication, runPortalRetention } from "@/app/lib/portalDb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  try {
    if (!isPortalConfigured()) {
      throw new PortalPublishError("PORTAL_SECRET não configurado no servidor. Configure antes de publicar.", 503);
    }

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: unknown;
      consultaId?: unknown;
      content?: unknown;
      doctorConfirmed?: unknown;
    };
    if (typeof body.patientId !== "string" || typeof body.consultaId !== "string") {
      return NextResponse.json({ error: "patientId e consultaId são obrigatórios." }, { status: 400 });
    }
    if (body.doctorConfirmed !== true) {
      return NextResponse.json({ error: "Confirme que o paciente solicitou o acesso digital." }, { status: 400 });
    }
    const parsed = parsePortalContent(body.content);
    if (!parsed.success) {
      return NextResponse.json({ error: "Conteúdo inválido. Gere a prévia novamente." }, { status: 422 });
    }

    const context = await loadPublishContext(body.patientId, body.consultaId);
    const parts = deriveParts(context.consulta);
    const content = validateContent(parsed.data, parts, context.labSeries, context.sex);

    const now = new Date();
    const expiresAt = expiryFrom(now);
    const payload = assemblePayload({
      context,
      parts,
      content,
      publishedAt: now.toISOString(),
      expiresAt,
    });

    const token = newToken();
    const { id } = await createPublication({
      patientId: context.patient.id,
      consultaId: context.consulta.id,
      tokenHash: hashToken(token),
      tokenEnc: encryptToken(token),
      cpfHmac: hashCpf(context.cpfDigits),
      patientFirstName: context.firstName,
      payload,
      doctorConfirmedAt: now.toISOString(),
      expiresAt,
    });

    runPortalRetention().catch((err) => logger.warn("Portal retention failed", { error: String(err) }));

    return NextResponse.json({ id, token, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof PortalPublishError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error("Portal publish failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao publicar." }, { status: 500 });
  }
}
