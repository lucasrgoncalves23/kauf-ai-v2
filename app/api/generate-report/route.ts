import { NextRequest, NextResponse } from "next/server";
import type { ClinicalInput } from "@/app/types/clinical";
import { runEngine } from "@/app/lib/engine";

type PatientSnapshot = {
  age?: string;
  sex?: string;
  height?: string;
  weight?: string;
  objective?: string;
  primaryRisk?: string;
  discipline?: string;
  phase?: string;
  objectiveConfirmed?: boolean;
};

// Backward compatible: support either a raw ClinicalInput OR { patient: PatientSnapshot }
type GenerateReportRequest =
  | ClinicalInput
  | {
      patient: PatientSnapshot;
    };

function isWrappedPatient(body: any): body is { patient: PatientSnapshot } {
  return body && typeof body === "object" && "patient" in body;
}

function buildClinicalInputFromPatient(p: PatientSnapshot): ClinicalInput {
  // IMPORTANT: this maps your UI snapshot into the engine schema.
  // You can expand this later (labs, wearable, etc).
  return {
    phaseAssumption: p.phase?.trim() || undefined,
    base: {
      // Only trust objective if confirmed; otherwise treat as missing
      chiefComplaint:
        (p.objectiveConfirmed ? p.objective?.trim() : "")?.trim() || "N/A",
    },
    wearable: undefined,
    labs: undefined,
  } as ClinicalInput;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateReportRequest;

  const input: ClinicalInput = isWrappedPatient(body)
    ? buildClinicalInputFromPatient(body.patient)
    : (body as ClinicalInput);

  const { decision, report } = runEngine(input);

  return NextResponse.json({
    status: "ok",
    decision,
    report,

    // Explainability payload (deterministic; safe to log)
    meta: {
      inputsUsed: input,
      generatedAt: new Date().toISOString(),
    },
  });
}
