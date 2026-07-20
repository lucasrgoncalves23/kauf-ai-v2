/**
 * CRM Bridge (outbound)
 *
 * Notifies the Kaufmann Clinic OS CRM when a consulta is saved, sending
 * the operational outcome (conduta + notes). The CRM extracts follow-up
 * actions ("retorno semana que vem" → suggested task, pending approval).
 *
 * Best-effort: failures are logged and never block saving the consulta.
 * Configure CRM_WEBHOOK_URL and KAUF_BRIDGE_SECRET (shared secret).
 */

import { logger } from "./logger";
import type { Consulta, PatientRecord } from "../types/clinical";

export async function notifyCrmConsultaFinalizada(
  patient: PatientRecord,
  consulta: Consulta
): Promise<void> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.KAUF_BRIDGE_SECRET;
  if (!url || !secret) return; // ponte não configurada

  const resumo = [consulta.outputs?.conduta, consulta.notes]
    .filter((s) => s?.trim())
    .join("\n\n");
  if (!resumo) {
    logger.debug("CRM bridge: consulta without conduta/notes, skipping notify", {
      consultaId: consulta.id,
    });
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "consulta_finalizada",
        paciente: {
          kauf_id: patient.id,
          cpf: patient.profile?.cpf || undefined,
          telefone: patient.profile?.phone || undefined,
        },
        resumo,
        fase: consulta.engineStatus?.phase ?? undefined,
        // receita → CRM extrai as medicações (lembretes de renovação, busca)
        receita: consulta.outputs?.receita?.trim() || undefined,
      }),
    });
    if (!res.ok) {
      logger.warn("CRM bridge: notify failed", {
        status: res.status,
        body: (await res.text()).slice(0, 200),
      });
      return;
    }
    const data = await res.json().catch(() => ({}));
    logger.info("CRM bridge: consulta notified", {
      consultaId: consulta.id,
      sugestoes: data.sugestoes,
    });
  } catch (error) {
    logger.warn("CRM bridge: notify error", { error: String(error) });
  }
}

/**
 * Notifies the CRM that a document was exported (patient-friendly plan or
 * prescription) so it can be delivered digitally via WhatsApp. Best-effort.
 * Returns the public URL created by the CRM, when available.
 */
export async function notifyCrmDocumentoExportado(
  patient: PatientRecord,
  docType: "patient_pdf" | "prescription" | "clinical",
  content: string
): Promise<string | null> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.KAUF_BRIDGE_SECRET;
  if (!url || !secret || !content.trim()) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "documento_exportado",
        paciente: {
          kauf_id: patient.id,
          cpf: patient.profile?.cpf || undefined,
          telefone: patient.profile?.phone || undefined,
        },
        doc_type: docType,
        content,
      }),
    });
    if (!res.ok) {
      logger.warn("CRM bridge: documento_exportado failed", {
        status: res.status,
      });
      return null;
    }
    const data = await res.json().catch(() => ({}));
    logger.info("CRM bridge: documento exported", {
      patientId: patient.id,
      docType,
      url: data.url,
    });
    return data.url ?? null;
  } catch (error) {
    logger.warn("CRM bridge: documento_exportado error", { error: String(error) });
    return null;
  }
}
