import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { encryptToken, hashToken, isPortalConfigured, newToken } from "@/app/lib/portal/crypto";
import { expiryFrom } from "@/app/lib/portal/assemble";
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
    });

    return NextResponse.json({ id: created.id, token, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("Portal reissue failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao gerar novo link." }, { status: 500 });
  }
}
