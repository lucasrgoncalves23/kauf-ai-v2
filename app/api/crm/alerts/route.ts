/**
 * Clinical/operational alerts pushed by the Clinic OS CRM (alerta_clinico).
 * GET lists active alerts; PATCH dismisses one.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { dismissCrmAlert, getActiveCrmAlerts } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const alerts = await getActiveCrmAlerts();
    return NextResponse.json({ alerts });
  } catch (error) {
    logger.error("Failed to fetch CRM alerts", { error: String(error) });
    return NextResponse.json({ error: "Falha ao buscar alertas" }, { status: 500 });
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
    const dismissed = await dismissCrmAlert(body.id);
    return NextResponse.json({ ok: dismissed });
  } catch (error) {
    logger.error("Failed to dismiss CRM alert", { error: String(error) });
    return NextResponse.json({ error: "Falha ao dispensar alerta" }, { status: 500 });
  }
}
