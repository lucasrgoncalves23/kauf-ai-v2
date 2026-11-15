import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { encryptToken, hashToken, isPortalConfigured, newToken } from "@/app/lib/portal/crypto";
import { expiryFrom } from "@/app/lib/portal/assemble";
import { notifyCrmPortalPublicado } from "@/app/lib/crm";
import { getConsultas, getPatient } from "@/app/lib/db";
import { portalPublicUrl } from "@/app/lib/portal/link";
import { createPublication, getPublicationById } from "@/app/lib/portalDb";

export const runtime = "nodejs";

/** New link, same approved content. The previous publication is superseded. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  if (!isPortalConfigured()) {
    return NextResponse.json({ error: "PORTAL_SECRET não configurado no servidor." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const previous = await getPublicationById(id);
    if (!previous || !previous.patientActive) {
      return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
    }
    if (!previous.payload) {
      return NextResponse.json({ error: "Esta publicação foi revogada ou expirou. Publique novamente." }, { status: 409 });
    }

    const signature = previous.payload.signature;
    const now = new Date();
    const expiresAt = expiryFrom(now);
    const token = newToken();
    const created = await createPublication({
      patientId: previous.patientId,
      consultaId: previous.consultaId,
      tokenHash: hashToken(token),
      tokenEnc: encryptToken(token),
      cpfHmac: previous.cpfHmac,
      patientFirstName: previous.patientFirstName,
      payload: { ...previous.payload, expiresAt },
      doctorConfirmedAt: previous.doctorConfirmedAt || now.toISOString(),
      expiresAt,
      // Same content, so the signature carries over (its hash excludes the expiry)
      signature: signature ? { signedBy: signature.signer, signedAt: signature.signedAt, payloadHash: signature.hash } : null,
    });

    // o CRM passa a ter o novo link (o anterior vira substituído lá também)
    const publicUrl = portalPublicUrl(token);
    if (publicUrl) {
      const [patient, consultas] = await Promise.all([getPatient(previous.patientId), getConsultas(previous.patientId)]);
      const consulta = consultas.find((c) => c.id === previous.consultaId);
      if (patient) {
        await notifyCrmPortalPublicado(patient, {
          id: created.id,
          url: publicUrl,
          expiresAt,
          consultaAt: consulta?.timestamp ?? null,
        });
      }
    } else {
      logger.warn("PORTAL_PUBLIC_URL not set: CRM not notified of the reissued link", { publicationId: created.id });
    }

    return NextResponse.json({ id: created.id, token, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("Portal reissue failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao gerar novo link." }, { status: 500 });
  }
}
