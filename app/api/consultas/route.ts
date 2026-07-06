import { NextResponse } from "next/server";
import { getAllConsultas } from "../../lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

function verifyPin(request: Request): boolean {
  const clinicPin = process.env.CLINIC_PIN;
  if (!clinicPin) return true;
  const providedPin = request.headers.get("X-Clinic-Pin");
  return providedPin === clinicPin;
}

// GET /api/consultas - List all consultas across all patients
export async function GET(request: Request) {
  if (!verifyPin(request)) {
    return NextResponse.json({ error: "PIN invalido" }, { status: 401 });
  }

  try {
    const consultas = await getAllConsultas();
    return NextResponse.json({ consultas });
  } catch (error) {
    logger.error("Failed to fetch all consultas", { error: String(error) });
    return NextResponse.json(
      { error: "Falha ao buscar consultas" },
      { status: 500 }
    );
  }
}
