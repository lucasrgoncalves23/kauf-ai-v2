/**
 * Today's agenda pushed by the Clinic OS CRM (agenda_hoje webhook event).
 * Shown in the left sidebar so the doctor sees the day's patients at a glance.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { getCrmAgenda } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    // "hoje" no fuso da clínica (São Paulo, UTC-3) — mesma chave usada pelo CRM
    const today = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const agenda = await getCrmAgenda(today);
    return NextResponse.json({
      date: today,
      appointments: agenda?.appointments ?? [],
      updatedAt: agenda?.updatedAt ?? null,
    });
  } catch (error) {
    logger.error("Failed to fetch CRM agenda", { error: String(error) });
    return NextResponse.json({ error: "Falha ao buscar agenda" }, { status: 500 });
  }
}
