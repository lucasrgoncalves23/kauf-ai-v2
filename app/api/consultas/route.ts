import { NextResponse } from "next/server";
import { getAllConsultaSummaries } from "../../lib/db";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";

export const runtime = "nodejs";

// GET /api/consultas - List all consultas across all patients (summaries only;
// the full snapshots come from /api/patients/[id]/consultas for the open patient)
export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const consultas = await getAllConsultaSummaries();
    return NextResponse.json({ consultas });
  } catch (error) {
    logger.error("Failed to fetch all consultas", { error: String(error) });
    return NextResponse.json(
      { error: "Falha ao buscar consultas" },
      { status: 500 }
    );
  }
}
