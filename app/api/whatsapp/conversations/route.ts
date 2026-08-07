/**
 * WhatsApp Conversation List API
 *
 * GET — One entry per phone that ever exchanged a message with the clinic,
 * most recent first. Includes patient-linked AND unlinked threads, plus
 * whether the 24h customer-service window is currently open.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "../../../lib/auth";
import { getWaConversationSummaries } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  const conversations = await getWaConversationSummaries();
  return NextResponse.json({ conversations });
}
