/**
 * WhatsApp Opt-In / Opt-Out API (LGPD)
 *
 * POST — Record patient consent for WhatsApp messaging.
 * DELETE — Revoke consent (opt-out). Stops all automated messages.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "../../../lib/auth";
import { getPatient, setWaOptIn, revokeWaOptIn, getWaOptIn } from "../../../lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  let body: { patientId: string; method?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { patientId, method } = body;
  if (!patientId) {
    return NextResponse.json(
      { error: "Informe patientId" },
      { status: 422 }
    );
  }

  const patient = await getPatient(patientId);
  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const phone = patient.profile.phone?.replace(/\D/g, "");
  if (!phone) {
    return NextResponse.json(
      { error: "Paciente sem número de WhatsApp cadastrado" },
      { status: 422 }
    );
  }

  await setWaOptIn(patientId, phone, method ?? "dashboard");
  logger.info("WhatsApp opt-in: consent recorded", { patientId, phone, method });

  return NextResponse.json({ ok: true, consented: true });
}

export async function DELETE(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  let body: { patientId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { patientId } = body;
  if (!patientId) {
    return NextResponse.json(
      { error: "Informe patientId" },
      { status: 422 }
    );
  }

  await revokeWaOptIn(patientId);
  logger.info("WhatsApp opt-out: consent revoked", { patientId });

  return NextResponse.json({ ok: true, consented: false });
}

export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json(
      { error: "Informe patientId" },
      { status: 422 }
    );
  }

  const optIn = await getWaOptIn(patientId);
  return NextResponse.json({
    consented: !!optIn && !optIn.revokedAt,
    consentedAt: optIn?.consentedAt ?? null,
    revokedAt: optIn?.revokedAt ?? null,
    method: optIn?.consentMethod ?? null,
  });
}
