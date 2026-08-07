/**
 * WhatsApp Conversation History API
 *
 * GET — Returns the message history for a patient's WhatsApp conversation.
 * Query params: patientId (required), limit (default 50), before (ISO cursor).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyClinicPin } from "../../../lib/auth";
import { getWaMessages, getWaOptIn } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  const patientId = request.nextUrl.searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json(
      { error: "Informe patientId" },
      { status: 422 }
    );
  }

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
    200
  );
  const before = request.nextUrl.searchParams.get("before") ?? undefined;

  const [messages, optIn] = await Promise.all([
    getWaMessages(patientId, limit, before),
    getWaOptIn(patientId),
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
