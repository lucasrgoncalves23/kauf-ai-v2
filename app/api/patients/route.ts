import { NextResponse } from "next/server";
import { getAllPatients, createPatient } from "../../lib/db";
import { logger } from "@/app/lib/logger";
import type { PatientRecord } from "../../types/clinical";

export const runtime = "nodejs";

// Simple PIN verification
function verifyPin(request: Request): boolean {
  const clinicPin = process.env.CLINIC_PIN;

  // If no PIN is configured, allow access (for development)
  if (!clinicPin) return true;

  const providedPin = request.headers.get("X-Clinic-Pin");
  return providedPin === clinicPin;
}

// GET /api/patients - List all patients
export async function GET(request: Request) {
  if (!verifyPin(request)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  try {
    const patients = await getAllPatients();
    return NextResponse.json({ patients });
  } catch (error) {
    logger.error("Failed to fetch patients", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

// POST /api/patients - Create a new patient
export async function POST(request: Request) {
  if (!verifyPin(request)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const patient = body as PatientRecord;

    // Validate required fields
    if (!patient.id || !patient.name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    // Ensure timestamps exist
    const now = new Date().toISOString();
    const patientWithTimestamps: PatientRecord = {
      ...patient,
      createdAt: patient.createdAt || now,
      updatedAt: patient.updatedAt || now,
      inputs: patient.inputs || { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
      outputs: patient.outputs || { analise: "", conduta: "", receita: "" },
      profile: patient.profile || { name: "", age: "", sex: "", cpf: "", birthDate: "" },
      chatMessages: patient.chatMessages || [],
      engineStatus: patient.engineStatus || null,
    };

    const created = await createPatient(patientWithTimestamps);
    return NextResponse.json({ patient: created }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create patient", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to create patient" },
      { status: 500 }
    );
  }
}
