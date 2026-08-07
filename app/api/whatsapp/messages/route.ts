/**
 * WhatsApp Conversation History API
 *
 * GET — Returns the message history for a WhatsApp thread.
 * Query params: patientId OR phone (one required), limit (default 50),
 * before (ISO cursor, patientId mode only).
 * Phone mode also returns the 24h-window state and the linked patient,
 * so the inbox can decide between free-form reply and template picker.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyClinicPin } from "../../../lib/auth";
import {
  getWaMessages,
  getWaMessagesByPhone,
  getWaOptIn,
  getActiveWaConversation,
  findPatientByPhone,
} from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  const patientId = request.nextUrl.searchParams.get("patientId");
  const phone = request.nextUrl.searchParams.get("phone");
  if (!patientId && !phone) {
    return NextResponse.json(
      { error: "Informe patientId ou phone" },
      { status: 422 }
    );
  }

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
    200
  );
  const before = request.nextUrl.searchParams.get("before") ?? undefined;

  if (phone) {
    const [messages, conv, patient] = await Promise.all([
      getWaMessagesByPhone(phone, limit),
      getActiveWaConversation(phone),
      findPatientByPhone(phone),
    ]);
    const optIn = patient ? await getWaOptIn(patient.id) : null;

    return NextResponse.json({
      messages,
      window: { open: !!conv, expiresAt: conv?.expiresAt ?? null },
      patient: patient ? { id: patient.id, name: patient.name } : null,
      optIn: optIn
        ? {
            consented: !optIn.revokedAt,
            consentedAt: optIn.consentedAt,
            revokedAt: optIn.revokedAt,
            method: optIn.consentMethod,
          }
        : null,
      hasMore: messages.length === limit,
    });
  }

  const [messages, optIn] = await Promise.all([
    getWaMessages(patientId!, limit, before),
    getWaOptIn(patientId!),
  ]);

  return NextResponse.json({
    messages,
    optIn: optIn
      ? {
          consented: !optIn.revokedAt,
          consentedAt: optIn.consentedAt,
          revokedAt: optIn.revokedAt,
          method: optIn.consentMethod,
        }
      : null,
    hasMore: messages.length === limit,
  });
}
