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
import { createRateLimiter } from "@/app/lib/portal/rateLimit";
import { isValidSignatureImage, signPayload, verifySigningPin } from "@/app/lib/portal/signature";

// Blunts guessing of the doctor's signing code from a logged-in clinic session
const signingLimiter = createRateLimiter(15 * 60 * 1000, 8);

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
      signature?: { image?: unknown; pin?: unknown; reviewed?: unknown };
    };
    if (typeof body.patientId !== "string" || typeof body.consultaId !== "string") {
      return NextResponse.json({ error: "patientId e consultaId são obrigatórios." }, { status: 400 });
    }
    if (body.doctorConfirmed !== true) {
      return NextResponse.json({ error: "Confirme que o paciente solicitou o acesso digital." }, { status: 400 });
    }
    if (body.signature?.reviewed !== true || !isValidSignatureImage(body.signature.image)) {
      return NextResponse.json({ error: "Assine o plano antes de publicar." }, { status: 400 });
    }
    if (!signingLimiter.check(body.patientId).allowed) {
      return NextResponse.json({ error: "Muitas tentativas de assinatura. Aguarde alguns minutos." }, { status: 429 });
    }
    if (!verifySigningPin(body.signature.pin)) {
      return NextResponse.json({ error: "Código de assinatura incorreto." }, { status: 403 });
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
    const payload = signPayload(
      assemblePayload({ context, parts, content, publishedAt: now.toISOString(), expiresAt, edited: true }),
      body.signature.image,
      now.toISOString()
    );
    const signature = payload.signature!;

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
      signature: { signedBy: signature.signer, signedAt: signature.signedAt, payloadHash: signature.hash },
    });

    runPortalRetention().catch((err) => logger.warn("Portal retention failed", { error: String(err) }));

    return NextResponse.json({ id, token, expiresAt, signatureCode: signature.code }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof PortalPublishError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error("Portal publish failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao publicar." }, { status: 500 });
  }
}
