/**
 * Forwards an exported document (patient-friendly plan or prescription) to
 * the Clinic OS CRM for digital delivery via WhatsApp. Called by the client
 * export handlers after printing — best-effort, never blocks the export.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { notifyCrmDocumentoExportado } from "@/app/lib/crm";
import { getPatient } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { patientId, docType, content } = body as {
      patientId?: string;
      docType?: "patient_pdf" | "prescription" | "clinical";
      content?: string;
    };

    if (!patientId || !docType || !content?.trim()) {
      return NextResponse.json(
        { error: "Informe patientId, docType e content" },
        { status: 400 }
      );
    }

    const patient = await getPatient(patientId);
    if (!patient) {
      return NextResponse.json({ error: "Paciente nao encontrado" }, { status: 404 });
    }

    const url = await notifyCrmDocumentoExportado(patient, docType, content);
    return NextResponse.json({ ok: url !== null, url });
  } catch (error) {
    logger.error("Export notify failed", { error: String(error) });
    return NextResponse.json({ error: "Falha ao notificar CRM" }, { status: 500 });
  }
}
