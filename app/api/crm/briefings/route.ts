/**
 * Pre-consulta briefings pushed by the Clinic OS CRM (briefing_pre_consulta):
 * what the patient said on WhatsApp since the last consulta.
 * GET lists a patient's latest briefings; PATCH marks one as added to the anamnese.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { getCrmBriefings, markCrmBriefingUsed } from "@/app/lib/db";
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
    const briefings = await getCrmBriefings(patientId, 3);
    return NextResponse.json({ briefings });
  } catch (error) {
    logger.error("Failed to fetch CRM briefings", { error: String(error) });
    return NextResponse.json({ error: "Falha ao buscar relatos" }, { status: 500 });
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
    return NextResponse.json({ ok: await markCrmBriefingUsed(body.id) });
  } catch (error) {
    logger.error("Failed to mark CRM briefing used", { error: String(error) });
    return NextResponse.json({ error: "Falha ao atualizar relato" }, { status: 500 });
  }
}
