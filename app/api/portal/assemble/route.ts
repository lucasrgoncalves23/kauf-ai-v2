import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { parsePortalContent } from "@/app/lib/portal/schema";
import { alignMedicationNotes } from "@/app/lib/portal/payload";
import { signingPinRequired } from "@/app/lib/portal/signature";
import {
  assemblePayload,
  contentIssues,
  deriveParts,
  expiryFrom,
  loadPublishContext,
  PortalPublishError,
  restrictToKnownMarkers,
} from "@/app/lib/portal/assemble";

export const runtime = "nodejs";

/**
 * Rebuilds the preview around already-edited content, without calling the model: used to resume
 * an editing draft after the doctor changed the receita/conduta. Issues are returned, not thrown,
 * so the doctor can fix them in the editor.
 */
export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { patientId?: unknown; consultaId?: unknown; content?: unknown };
    if (typeof body.patientId !== "string" || typeof body.consultaId !== "string") {
      return NextResponse.json({ error: "patientId e consultaId são obrigatórios." }, { status: 400 });
    }
    const parsed = parsePortalContent(body.content);
    if (!parsed.success) {
      return NextResponse.json({ error: "O rascunho salvo está incompleto. Gere a versão do paciente novamente." }, { status: 422 });
    }

    const context = await loadPublishContext(body.patientId, body.consultaId);
    const parts = deriveParts(context.consulta);
    const content = restrictToKnownMarkers(parsed.data, context.labSeries);

    const now = new Date();
    const payload = assemblePayload({ context, parts, content, publishedAt: now.toISOString(), expiresAt: expiryFrom(now), edited: true });

    return NextResponse.json(
      {
        content: alignMedicationNotes(content, payload.medicamentos),
        payload,
        issues: contentIssues(content, parts, context.sex),
        signingPinRequired: signingPinRequired(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof PortalPublishError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error("Portal assemble failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao montar a prévia." }, { status: 500 });
  }
}
