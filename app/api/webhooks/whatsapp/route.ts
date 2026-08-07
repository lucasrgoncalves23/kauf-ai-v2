/**
 * WhatsApp Webhook (inbound)
 *
 * GET  — Meta verification challenge (one-time setup).
 * POST — Incoming messages + delivery status updates from Meta Cloud API.
 *
 * Auth: X-Hub-Signature-256 HMAC verified against WHATSAPP_APP_SECRET.
 *
 * Inbound messages are stored in wa_messages and linked to patients
 * by phone number. Status updates (sent/delivered/read/failed) patch
 * existing outbound message rows.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  parseWebhookPayload,
} from "../../../lib/whatsapp";
import {
  insertWaMessage,
  updateWaMessageStatus,
  upsertWaConversation,
  findPatientByPhone,
  hasActiveWaConsent,
  setWaOptIn,
} from "../../../lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const result = verifyWebhookChallenge(mode, token, challenge);
  if (result) {
    logger.info("WhatsApp webhook: verification challenge accepted");
    return new NextResponse(result, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("WhatsApp webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, statuses } = parseWebhookPayload(body);

  for (const msg of messages) {
    try {
      const patient = await findPatientByPhone(msg.from);

      // A patient messaging the clinic is the consent event (LGPD): record
      // opt-in so outbound replies are not blocked. Never resets an existing
      // consent date; a revoked opt-in is re-established only by this new
      // inbound contact.
      if (patient && !(await hasActiveWaConsent(patient.id))) {
        await setWaOptIn(patient.id, msg.from, "inbound_message");
      }

      const twentyFourHoursFromNow = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();
      const convId = `wc-${msg.from}-${Date.now().toString(36)}`;
      await upsertWaConversation({
        id: convId,
        patientId: patient?.id ?? null,
        phone: msg.from,
        expiresAt: twentyFourHoursFromNow,
      });

      const mediaMarker =
        msg.type === "audio"
          ? "[Áudio recebido]"
          : msg.type === "image"
          ? "[Imagem recebida]"
          : msg.type === "document"
          ? "[Documento recebido]"
          : undefined;

      const msgId = `wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await insertWaMessage({
        id: msgId,
        patientId: patient?.id ?? null,
        waMessageId: msg.waMessageId,
        direction: "inbound",
        type: msg.type,
        body: msg.text ?? msg.buttonText ?? msg.interactiveTitle ?? mediaMarker,
        mediaId: msg.mediaId,
        phone: msg.from,
        status: "received",
      });

      if (msg.type === "button" && msg.buttonPayload) {
        await handleButtonReply(msg.from, msg.buttonPayload, patient?.id ?? null);
      }

      logger.info("WhatsApp webhook: inbound message stored", {
        from: msg.from,
        type: msg.type,
        patientId: patient?.id,
        msgId,
      });
    } catch (error) {
      logger.error("WhatsApp webhook: failed to process inbound message", {
        from: msg.from,
        error: String(error),
      });
    }
  }

  for (const s of statuses) {
    try {
      await updateWaMessageStatus(
        s.waMessageId,
        s.status,
        s.errorMessage
      );
      logger.debug("WhatsApp webhook: status update", {
        waMessageId: s.waMessageId,
        status: s.status,
      });
    } catch (error) {
      logger.error("WhatsApp webhook: failed to process status update", {
        waMessageId: s.waMessageId,
        error: String(error),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleButtonReply(
  phone: string,
  payload: string,
  patientId: string | null
): Promise<void> {
  switch (payload) {
    case "CONFIRM_APPOINTMENT":
      logger.info("WhatsApp: appointment confirmed", { phone, patientId });
      break;
    case "RESCHEDULE_APPOINTMENT":
      logger.info("WhatsApp: reschedule requested", { phone, patientId });
      break;
    case "SCHEDULE_RETURN":
      logger.info("WhatsApp: return scheduling requested", { phone, patientId });
      break;
    default:
      logger.debug("WhatsApp: unknown button payload", { phone, payload });
  }
}
