import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { decryptToken, isPortalConfigured } from "@/app/lib/portal/crypto";
import { listPublicationsForPatient } from "@/app/lib/portalDb";
import type { PublicationSummary } from "@/app/lib/portal/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const patientId = new URL(req.url).searchParams.get("patientId");
  if (!patientId) return NextResponse.json({ error: "patientId é obrigatório." }, { status: 400 });

  try {
    const rows = await listPublicationsForPatient(patientId);
    const configured = isPortalConfigured();
    const publications: PublicationSummary[] = rows.map((r) => {
      const summary: PublicationSummary = {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        openCount: r.openCount,
        firstOpenedAt: r.firstOpenedAt,
        lastOpenedAt: r.lastOpenedAt,
        failedAttempts: r.failedAttempts,
        lockedUntil: r.lockedUntil,
      };
      if (r.status === "active" && configured) {
        try {
          summary.token = decryptToken(r.tokenEnc);
        } catch (err) {
          logger.warn("Could not decrypt portal token", { id: r.id, error: String(err) });
        }
      }
      return summary;
    });
    return NextResponse.json({ publications, configured }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("Portal list failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao consultar publicações." }, { status: 500 });
  }
}
