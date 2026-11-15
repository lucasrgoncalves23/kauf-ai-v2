/**
 * Exams the patient sent on WhatsApp, forwarded by the Clinic OS CRM
 * (exame_recebido). Only the extracted text lives here.
 * GET lists a patient's exams; PATCH marks one as imported into Laboratoriais.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { getCrmExams, markCrmExamImported } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "Informe patientId" }, { status: 400 });
  }
  try {
    const exams = await getCrmExams(patientId, 10);
    return NextResponse.json({ exams });
  } catch (error) {
    logger.error("Failed to fetch CRM exams", { error: String(error) });
    return NextResponse.json({ error: "Falha ao buscar exames" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "Informe id" }, { status: 400 });
    }
    return NextResponse.json({ ok: await markCrmExamImported(body.id) });
  } catch (error) {
    logger.error("Failed to mark CRM exam imported", { error: String(error) });
    return NextResponse.json({ error: "Falha ao atualizar exame" }, { status: 500 });
  }
}
