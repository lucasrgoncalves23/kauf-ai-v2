/**
 * WhatsApp Notification Triggers
 *
 * Best-effort outbound notifications fired from clinical workflows.
 * Each function checks opt-in, builds the template, and sends.
 * Failures are logged and never block the calling flow.
 */

import { logger } from "./logger";
import {
  sendTemplate,
  isWhatsAppConfigured,
} from "./whatsapp";
import { getTemplate, type TemplateContext } from "./whatsappTemplates";
import { hasActiveWaConsent, insertWaMessage } from "./db";
import type { PatientRecord, Consulta } from "../types/clinical";

async function safeSendTemplate(
  patient: PatientRecord,
  templateName: string,
  ctx: TemplateContext
): Promise<void> {
  if (!isWhatsAppConfigured()) return;

  const phone = patient.profile.phone?.replace(/\D/g, "");
  if (!phone) return;

  const consented = await hasActiveWaConsent(patient.id);
  if (!consented) return;

  const spec = getTemplate(templateName);
  if (!spec) {
    logger.warn("WhatsApp notify: unknown template", { templateName });
    return;
  }

  const components = spec.buildComponents(ctx);
  const result = await sendTemplate({
    to: phone,
    templateName: spec.name,
    components,
  });

  const msgId = `wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
}

export async function notifyWhatsAppConsultaFinalizada(
  patient: PatientRecord,
  consulta: Consulta
): Promise<void> {
  try {
    await safeSendTemplate(patient, "consulta_resumo", { patient, consulta });
  } catch (error) {
    logger.warn("WhatsApp notify: consulta_resumo failed", {
      patientId: patient.id,
      error: String(error),
    });
  }
}

export async function notifyWhatsAppDocumentoExportado(
  patient: PatientRecord,
  docType: "patient_pdf" | "prescription" | "clinical",
  documentUrl?: string
): Promise<void> {
  try {
    await safeSendTemplate(patient, "documento_disponivel", {
      patient,
      documentType: docType,
      documentUrl,
    });
  } catch (error) {
    logger.warn("WhatsApp notify: documento_disponivel failed", {
      patientId: patient.id,
      error: String(error),
    });
  }
}

export async function notifyWhatsAppLembreteConsulta(
  patient: PatientRecord,
  date: string,
  time: string
): Promise<void> {
  try {
    await safeSendTemplate(patient, "lembrete_consulta", {
      patient,
      appointmentDate: date,
      appointmentTime: time,
    });
  } catch (error) {
    logger.warn("WhatsApp notify: lembrete_consulta failed", {
      patientId: patient.id,
      error: String(error),
    });
  }
}

export async function notifyWhatsAppRetornoFase(
  patient: PatientRecord,
  message: string
): Promise<void> {
  try {
    await safeSendTemplate(patient, "retorno_fase", {
      patient,
      customMessage: message,
    });
  } catch (error) {
    logger.warn("WhatsApp notify: retorno_fase failed", {
      patientId: patient.id,
      error: String(error),
    });
  }
}

export async function notifyWhatsAppFormularioAnamnese(
  patient: PatientRecord
): Promise<void> {
  try {
    await safeSendTemplate(patient, "formulario_anamnese", { patient });
  } catch (error) {
    logger.warn("WhatsApp notify: formulario_anamnese failed", {
      patientId: patient.id,
      error: String(error),
    });
  }
}
