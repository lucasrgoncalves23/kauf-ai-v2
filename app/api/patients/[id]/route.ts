import { NextResponse } from "next/server";
import { getPatient, updatePatient, deletePatient } from "../../../lib/db";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";
import type { PatientRecord } from "../../../types/clinical";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/patients/[id] - Get a single patient
export async function GET(request: Request, { params }: RouteParams) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const patient = await getPatient(id);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ patient });
  } catch (error) {
    logger.error("Failed to fetch patient", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}

// PUT /api/patients/[id] - Update a patient
export async function PUT(request: Request, { params }: RouteParams) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const updates = body as Partial<PatientRecord>;

    // Don't allow changing the ID
    delete updates.id;

    const updated = await updatePatient(id, updates);

    if (!updated) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ patient: updated });
  } catch (error) {
    logger.error("Failed to update patient", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to update patient" },
      { status: 500 }
    );
  }
}

// DELETE /api/patients/[id] - Delete a patient
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const deleted = await deletePatient(id);

    if (!deleted) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete patient", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}
