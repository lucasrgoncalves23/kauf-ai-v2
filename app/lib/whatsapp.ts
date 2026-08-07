/**
 * WhatsApp Business Cloud API Client
 *
 * Direct integration with Meta's Cloud API for sending and receiving
 * WhatsApp messages. Handles template messages (outbound, outside 24h
 * window), freeform messages (within 24h session), and media uploads.
 *
 * Env vars: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_BUSINESS_ID,
 *           WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET
 */

import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "./logger";

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export type WaMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type WaDirection = "outbound" | "inbound";

export type WaTemplateComponent =
  | { type: "header"; parameters: WaTemplateParam[] }
  | { type: "body"; parameters: WaTemplateParam[] }
  | { type: "button"; sub_type: "quick_reply"; index: number; parameters: [{ type: "payload"; payload: string }] };

export type WaTemplateParam =
  | { type: "text"; text: string }
  | { type: "document"; document: { link: string; filename: string } }
  | { type: "image"; image: { link: string } };

export interface WaSendTemplateRequest {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: WaTemplateComponent[];
}

export interface WaSendTextRequest {
  to: string;
  body: string;
  previewUrl?: boolean;
}

export interface WaSendDocumentRequest {
  to: string;
  documentUrl: string;
  filename: string;
  caption?: string;
}

export interface WaSendResult {
  waMessageId: string;
  status: WaMessageStatus;
}

export interface WaInboundMessage {
  from: string;
  waMessageId: string;
  timestamp: string;
  type: "text" | "button" | "interactive" | "image" | "document" | "audio" | "unknown";
  text?: string;
  buttonPayload?: string;
  buttonText?: string;
  interactiveId?: string;
  interactiveTitle?: string;
  mediaId?: string;
  mediaUrl?: string;
  profileName?: string;
}

export interface WaStatusUpdate {
  waMessageId: string;
  status: WaMessageStatus;
  timestamp: string;
  recipientPhone: string;
  errorCode?: number;
  errorMessage?: string;
}

export class WaApiError extends Error {
  readonly httpStatus: number;
  /** Meta error code, e.g. 131047 (re-engagement), 132000-range (template). */
  readonly code: number | undefined;

  constructor(httpStatus: number, apiError: Record<string, unknown>) {
    const inner = apiError?.error as Record<string, unknown> | undefined;
    const code = typeof inner?.code === "number" ? inner.code : undefined;
    super(
      `WhatsApp API error ${httpStatus}${code ? ` (code ${code})` : ""}: ${JSON.stringify(apiError)}`
    );
    this.name = "WaApiError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

function getConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return null;
  return { token, phoneId };
}

export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

async function waFetch(
  path: string,
  opts: RequestInit & { token: string }
): Promise<Response> {
  const { token, ...fetchOpts } = opts;
  return fetch(`${BASE_URL}${path}`, {
    ...fetchOpts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...fetchOpts.headers,
    },
  });
}

export async function sendTemplate(
  req: WaSendTemplateRequest
): Promise<WaSendResult> {
  const cfg = getConfig();
  if (!cfg) throw new Error("WhatsApp not configured");

  const body = {
    messaging_product: "whatsapp",
    to: req.to,
    type: "template",
    template: {
      name: req.templateName,
      language: { code: req.languageCode ?? "pt_BR" },
      ...(req.components?.length ? { components: req.components } : {}),
    },
  };

  const res = await waFetch(`/${cfg.phoneId}/messages`, {
    method: "POST",
    token: cfg.token,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error("WhatsApp: sendTemplate failed", {
      status: res.status,
      error: err,
      template: req.templateName,
      to: req.to,
    });
    throw new WaApiError(res.status, err);
  }

  const data = await res.json();
  const waMessageId = data.messages?.[0]?.id ?? "";
  logger.info("WhatsApp: template sent", {
    template: req.templateName,
    to: req.to,
    waMessageId,
  });
  return { waMessageId, status: "queued" };
}

export async function sendText(
  req: WaSendTextRequest
): Promise<WaSendResult> {
  const cfg = getConfig();
  if (!cfg) throw new Error("WhatsApp not configured");

  const body = {
    messaging_product: "whatsapp",
    to: req.to,
    type: "text",
    text: { body: req.body, preview_url: req.previewUrl ?? false },
  };

  const res = await waFetch(`/${cfg.phoneId}/messages`, {
    method: "POST",
    token: cfg.token,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error("WhatsApp: sendText failed", {
      status: res.status,
      error: err,
    });
    throw new Error(
      `WhatsApp API error ${res.status}: ${JSON.stringify(err)}`
    );
  }

  const data = await res.json();
  const waMessageId = data.messages?.[0]?.id ?? "";
  logger.info("WhatsApp: text sent", { to: req.to, waMessageId });
  return { waMessageId, status: "queued" };
}

export async function sendDocument(
  req: WaSendDocumentRequest
): Promise<WaSendResult> {
  const cfg = getConfig();
  if (!cfg) throw new Error("WhatsApp not configured");

  const body = {
    messaging_product: "whatsapp",
    to: req.to,
    type: "document",
    document: {
      link: req.documentUrl,
      filename: req.filename,
      ...(req.caption ? { caption: req.caption } : {}),
    },
  };

  const res = await waFetch(`/${cfg.phoneId}/messages`, {
    method: "POST",
    token: cfg.token,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error("WhatsApp: sendDocument failed", {
      status: res.status,
      error: err,
    });
    throw new Error(
      `WhatsApp API error ${res.status}: ${JSON.stringify(err)}`
    );
  }

  const data = await res.json();
  const waMessageId = data.messages?.[0]?.id ?? "";
  logger.info("WhatsApp: document sent", {
    to: req.to,
    waMessageId,
    filename: req.filename,
  });
  return { waMessageId, status: "queued" };
}

export async function markAsRead(waMessageId: string): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;

  await waFetch(`/${cfg.phoneId}/messages`, {
    method: "POST",
    token: cfg.token,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: waMessageId,
    }),
  }).catch((err) =>
    logger.warn("WhatsApp: markAsRead failed", { waMessageId, error: String(err) })
  );
}

/**
 * Verify Meta webhook signature (X-Hub-Signature-256).
 * Returns true if the payload is authentic.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    logger.warn("WhatsApp: WHATSAPP_APP_SECRET not set, rejecting webhook payload");
    return false;
  }
  if (!signature) return false;

  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const got = Buffer.from(signature);
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Verify token for Meta webhook GET verification challenge.
 */
export function verifyWebhookChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) return null;
  if (mode === "subscribe" && token === verifyToken) return challenge;
  return null;
}

/**
 * Parse the Meta webhook payload into structured inbound messages
 * and status updates.
 */
export function parseWebhookPayload(body: Record<string, unknown>): {
  messages: WaInboundMessage[];
  statuses: WaStatusUpdate[];
} {
  const messages: WaInboundMessage[] = [];
  const statuses: WaStatusUpdate[] = [];

  const entries = (body.entry as Array<Record<string, unknown>>) ?? [];
  for (const entry of entries) {
    const changes =
      (entry.changes as Array<Record<string, unknown>>) ?? [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown>;
      if (!value) continue;

      const contacts =
        (value.contacts as Array<Record<string, unknown>>) ?? [];
      const profileMap = new Map<string, string>();
      for (const c of contacts) {
        const waId = (c.wa_id ?? c.phone) as string;
        const name = ((c.profile as Record<string, unknown>)?.name ?? "") as string;
        if (waId) profileMap.set(waId, name);
      }

      const msgs =
        (value.messages as Array<Record<string, unknown>>) ?? [];
      for (const m of msgs) {
        const from = m.from as string;
        const parsed: WaInboundMessage = {
          from,
          waMessageId: m.id as string,
          timestamp: m.timestamp as string,
          type: "unknown",
          profileName: profileMap.get(from) ?? undefined,
        };

        switch (m.type) {
          case "text": {
            const t = m.text as Record<string, unknown>;
            parsed.type = "text";
            parsed.text = t?.body as string;
            break;
          }
          case "button": {
            const b = m.button as Record<string, unknown>;
            parsed.type = "button";
            parsed.buttonPayload = b?.payload as string;
            parsed.buttonText = b?.text as string;
            break;
          }
          case "interactive": {
            const i = m.interactive as Record<string, unknown>;
            parsed.type = "interactive";
            const reply =
              (i?.button_reply ?? i?.list_reply) as Record<string, unknown>;
            parsed.interactiveId = reply?.id as string;
            parsed.interactiveTitle = reply?.title as string;
            break;
          }
          case "image":
          case "document":
          case "audio": {
            const media = m[m.type as string] as Record<string, unknown>;
            parsed.type = m.type as "image" | "document" | "audio";
            parsed.mediaId = media?.id as string;
            parsed.text = media?.caption as string;
            break;
          }
          default:
            parsed.type = "unknown";
        }

        messages.push(parsed);
      }

      const sts =
        (value.statuses as Array<Record<string, unknown>>) ?? [];
      for (const s of sts) {
        const errors = (s.errors as Array<Record<string, unknown>>) ?? [];
        statuses.push({
          waMessageId: s.id as string,
          status: s.status as WaMessageStatus,
          timestamp: s.timestamp as string,
          recipientPhone: s.recipient_id as string,
          errorCode: errors[0]?.code as number | undefined,
          errorMessage: errors[0]?.title as string | undefined,
        });
      }
    }
  }

  return { messages, statuses };
}
