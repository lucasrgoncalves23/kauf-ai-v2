import { NextResponse } from "next/server";
import { getConsultas, createConsulta, getPatient } from "../../../../lib/db";
import { logger } from "@/app/lib/logger";
import type { Consulta } from "../../../../types/clinical";

export const runtime = "nodejs";

function verifyPin(request: Request): boolean {
  const clinicPin = process.env.CLINIC_PIN;
  if (!clinicPin) return true;
  const providedPin = request.headers.get("X-Clinic-Pin");
  return providedPin === clinicPin;
}

// GET /api/patients/[id]/consultas - List consultas for a patient
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyPin(request)) {
    return NextResponse.json({ error: "PIN invalido" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const patient = await getPatient(id);
    if (!patient) {
      return NextResponse.json({ error: "Paciente nao encontrado" }, { status: 404 });
    }

    const consultas = await getConsultas(id);
    return NextResponse.json({ consultas });
  } catch (error) {
    logger.error("Failed to fetch consultas", { error: String(error) });
    return NextResponse.json(
      { error: "Falha ao buscar consultas" },
      { status: 500 }
    );
  }
}

// POST /api/patients/[id]/consultas - Save a new consulta
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyPin(request)) {
    return NextResponse.json({ error: "PIN invalido" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const patient = await getPatient(id);
    if (!patient) {
      return NextResponse.json({ error: "Paciente nao encontrado. Salve o paciente primeiro." }, { status: 404 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    const consulta: Consulta = {
      id: body.id || `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: id,
      timestamp: body.timestamp || now,
      inputs: body.inputs || { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
      outputs: body.outputs || { analise: "", conduta: "", receita: "" },
      engineStatus: body.engineStatus || null,
      notes: body.notes || "",
    };

    const created = await createConsulta(consulta);
    return NextResponse.json({ consulta: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to create consulta", { error: message });
    return NextResponse.json(
      { error: `Falha ao salvar consulta: ${message}` },
      { status: 500 }
    );
  }
}
