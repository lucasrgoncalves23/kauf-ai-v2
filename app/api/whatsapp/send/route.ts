/**
 * WhatsApp Send Message API
 *
 * POST — Send a template or freeform WhatsApp message to a patient, or a
 * freeform text reply to an unlinked phone (inbox thread without a matched
 * patient record). Requires clinic PIN auth. Checks LGPD opt-in for linked
 * patients; unlinked replies are allowed only as text inside the 24h window
 * the patient themselves opened by messaging the clinic.
 * Send failures return the Meta error code and an actionable pt-BR message.
 */

import { NextResponse } from "next/server";
import { verifyClinicPin } from "../../../lib/auth";
import {
  sendTemplate,
  sendText,
  sendDocument,
  isWhatsAppConfigured,
  WaApiError,
} from "../../../lib/whatsapp";
import { waSendFailureMessage } from "../../../lib/whatsappErrors";
import { getTemplate, type TemplateContext } from "../../../lib/whatsappTemplates";
import {
  getPatient,
  hasActiveWaConsent,
  getActiveWaConversation,
  insertWaMessage,
  findPatientByPhone,
} from "../../../lib/db";
import { logger } from "@/app/lib/logger";
import type { PatientRecord } from "../../../types/clinical";

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
    patientId?: string;
    phone?: string;
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

  const { type } = body;
  if ((!body.patientId && !body.phone) || !type) {
    return NextResponse.json(
      { error: "Informe patientId ou phone, e type" },
      { status: 422 }
    );
  }

  let patient: PatientRecord | null = null;
  let phone: string | undefined;

  if (body.patientId) {
    patient = await getPatient(body.patientId);
    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }
    phone = patient.profile.phone?.replace(/\D/g, "");
    if (!phone) {
      return NextResponse.json(
        { error: "Paciente sem número de WhatsApp cadastrado" },
        { status: 422 }
      );
    }
  } else {
    phone = String(body.phone).replace(/\D/g, "");
    if (!phone) {
      return NextResponse.json({ error: "Número inválido" }, { status: 422 });
    }
    patient = await findPatientByPhone(phone);
  }

  if (patient) {
    const consented = await hasActiveWaConsent(patient.id);
    if (!consented) {
      return NextResponse.json(
        { error: "Paciente não autorizou comunicação via WhatsApp (LGPD)" },
        { status: 403 }
      );
    }
  } else if (type !== "text") {
    // Unlinked phones: only a text reply inside the patient-opened 24h
    // window — templates/documents need a patient record.
    return NextResponse.json(
      {
        error:
          "Número sem paciente vinculado — apenas resposta de texto dentro da janela de 24h.",
      },
      { status: 422 }
    );
  }

  try {
    const msgId = `wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (type === "template") {
      if (!patient) {
        return NextResponse.json(
          { error: "Template requer paciente vinculado" },
          { status: 422 }
        );
      }
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
        patientId: patient.id,
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
        patientId: patient?.id ?? null,
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
        patientId: patient?.id ?? null,
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
      patientId: patient?.id ?? null,
      phone,
      type,
      metaErrorCode: error instanceof WaApiError ? error.code : undefined,
      error: String(error),
    });
    if (error instanceof WaApiError) {
      return NextResponse.json(
        { error: waSendFailureMessage(error.code), code: error.code ?? null },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: waSendFailureMessage(null) },
      { status: 500 }
    );
  }
}
