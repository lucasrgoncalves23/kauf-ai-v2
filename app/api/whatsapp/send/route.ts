/**
 * WhatsApp Send Message API
 *
 * POST — Send a template or freeform WhatsApp message to a patient.
 * Requires clinic PIN auth. Checks LGPD opt-in before sending.
 * Freeform text is only allowed within an active 24h conversation window.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "../../../lib/auth";
import {
  sendTemplate,
  sendText,
  sendDocument,
  isWhatsAppConfigured,
} from "../../../lib/whatsapp";
import { getTemplate, type TemplateContext } from "../../../lib/whatsappTemplates";
import {
  getPatient,
  hasActiveWaConsent,
  getActiveWaConversation,
  insertWaMessage,
} from "../../../lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  if (!isWhatsAppConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp não configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)" },
      { status: 503 }
    );
  }

  let body: {
    patientId: string;
    type: "template" | "text" | "document";
    templateName?: string;
    text?: string;
    documentUrl?: string;
    documentFilename?: string;
    documentCaption?: string;
    templateContext?: Partial<TemplateContext>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { patientId, type } = body;
  if (!patientId || !type) {
    return NextResponse.json(
      { error: "Informe patientId e type" },
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

  const consented = await hasActiveWaConsent(patientId);
  if (!consented) {
    return NextResponse.json(
      { error: "Paciente não autorizou comunicação via WhatsApp (LGPD)" },
      { status: 403 }
    );
  }

  try {
    const msgId = `wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (type === "template") {
      const templateName = body.templateName;
      if (!templateName) {
        return NextResponse.json(
          { error: "Informe templateName" },
          { status: 422 }
        );
      }
      const spec = getTemplate(templateName);
      if (!spec) {
        return NextResponse.json(
          { error: `Template desconhecido: ${templateName}` },
          { status: 422 }
        );
      }

      const ctx: TemplateContext = {
        patient,
        ...body.templateContext,
      };
      const components = spec.buildComponents(ctx);

      const result = await sendTemplate({
        to: phone,
        templateName: spec.name,
        components,
      });

      await insertWaMessage({
        id: msgId,
        patientId,
        waMessageId: result.waMessageId,
        direction: "outbound",
        type: "template",
        templateName,
        body: `[Template: ${templateName}]`,
        phone,
        status: result.status,
      });

      return NextResponse.json({
        ok: true,
        messageId: msgId,
        waMessageId: result.waMessageId,
        status: result.status,
      });
    }

    if (type === "text") {
      if (!body.text?.trim()) {
        return NextResponse.json(
          { error: "Informe text" },
          { status: 422 }
        );
      }

      const conv = await getActiveWaConversation(phone);
      if (!conv) {
        return NextResponse.json(
          {
            error:
              "Sem janela de conversa ativa (24h). Use um template para iniciar.",
          },
          { status: 422 }
        );
      }

      const result = await sendText({ to: phone, body: body.text });

      await insertWaMessage({
        id: msgId,
        patientId,
        waMessageId: result.waMessageId,
        direction: "outbound",
        type: "text",
        body: body.text,
        phone,
        status: result.status,
      });

      return NextResponse.json({
        ok: true,
        messageId: msgId,
        waMessageId: result.waMessageId,
        status: result.status,
      });
    }

    if (type === "document") {
      if (!body.documentUrl || !body.documentFilename) {
        return NextResponse.json(
          { error: "Informe documentUrl e documentFilename" },
          { status: 422 }
        );
      }

      const result = await sendDocument({
        to: phone,
        documentUrl: body.documentUrl,
        filename: body.documentFilename,
        caption: body.documentCaption,
      });

      await insertWaMessage({
        id: msgId,
        patientId,
        waMessageId: result.waMessageId,
        direction: "outbound",
        type: "document",
        body: body.documentCaption ?? `[Documento: ${body.documentFilename}]`,
        mediaUrl: body.documentUrl,
        phone,
        status: result.status,
      });

      return NextResponse.json({
        ok: true,
        messageId: msgId,
        waMessageId: result.waMessageId,
        status: result.status,
      });
    }

    return NextResponse.json(
      { error: `Tipo inválido: ${type}` },
      { status: 422 }
    );
  } catch (error) {
    logger.error("WhatsApp send: failed", {
      patientId,
      type,
      error: String(error),
    });
    return NextResponse.json(
      { error: "Falha ao enviar mensagem" },
      { status: 500 }
    );
  }
}
