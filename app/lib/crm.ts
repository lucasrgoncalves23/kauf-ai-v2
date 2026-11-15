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
import { buildCrmPatientPayload, buildRetornoPayload, type CrmRetornoPayload } from "./crmPayload";
import { getConsultas } from "./db";
import { computeFollowUp } from "./followUp";
import type { Consulta, PatientRecord } from "../types/clinical";

/**
 * Creates or updates the patient in the CRM ("paciente_upsert"). Without
 * this, a patient registered directly here never appears in the CRM and its
 * consultations and documents are rejected there (404). Skipped until the
 * patient has a name and a complete WhatsApp number (the CRM's identity).
 * Best-effort: returns false on failure, never throws.
 */
export async function notifyCrmPacienteUpsert(patient: PatientRecord): Promise<boolean> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.KAUF_BRIDGE_SECRET;
  if (!url || !secret) return false; // ponte não configurada

  const paciente = buildCrmPatientPayload(patient);
  if (!paciente) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "paciente_upsert", paciente }),
    });
    if (!res.ok) {
      logger.warn("CRM bridge: paciente_upsert failed", {
        patientId: patient.id,
        status: res.status,
        body: (await res.text()).slice(0, 200),
      });
      return false;
    }
    const data = await res.json().catch(() => ({}));
    logger.info("CRM bridge: patient upserted", {
      patientId: patient.id,
      crmId: data.crm_id,
      created: data.created,
    });
    return true;
  } catch (error) {
    logger.warn("CRM bridge: paciente_upsert error", { error: String(error) });
    return false;
  }
}

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

  // garante que o paciente existe no CRM (pastas criadas aqui, ou falhas
  // anteriores de sincronização) — senão o CRM responde 404
  await notifyCrmPacienteUpsert(patient);

  // plano de retorno estruturado (mesma regra do card "Próximo Retorno"):
  // o CRM convida o paciente na data certa e lembra os exames sugeridos
  let retorno: CrmRetornoPayload | undefined;
  try {
    const consultas = await getConsultas(patient.id);
    const all = consultas.some((c) => c.id === consulta.id) ? consultas : [...consultas, consulta];
    retorno = buildRetornoPayload(computeFollowUp(all, consulta.inputs, consulta.engineStatus));
  } catch (error) {
    logger.warn("CRM bridge: could not compute retorno", { error: String(error) });
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
        // quando a consulta aconteceu → o CRM conclui a consulta correspondente
        consulta_em: consulta.timestamp,
        retorno,
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

export interface PortalPublicationRef {
  id: string;
  url: string;
  expiresAt: string;
  consultaAt: string | null;
}

/**
 * Tells the CRM a portal report was published (or reissued) so it can send the
 * link on WhatsApp. Best-effort: never throws, returns false on failure.
 */
export async function notifyCrmPortalPublicado(
  patient: PatientRecord,
  pub: PortalPublicationRef
): Promise<boolean> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.KAUF_BRIDGE_SECRET;
  if (!url || !secret) return false;

  await notifyCrmPacienteUpsert(patient);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "portal_publicado",
        paciente: {
          kauf_id: patient.id,
          cpf: patient.profile?.cpf || undefined,
          telefone: patient.profile?.phone || undefined,
        },
        publicacao: {
          id: pub.id,
          url: pub.url,
          expires_at: pub.expiresAt,
          consulta_em: pub.consultaAt,
        },
      }),
      signal: AbortSignal.timeout(8000), // a publicação não espera o CRM além disso
    });
    if (!res.ok) {
      logger.warn("CRM bridge: portal_publicado failed", { status: res.status });
      return false;
    }
    logger.info("CRM bridge: portal link sent to CRM", { patientId: patient.id, publicationId: pub.id });
    return true;
  } catch (error) {
    logger.warn("CRM bridge: portal_publicado error", { error: String(error) });
    return false;
  }
}

/** Tells the CRM a publication was revoked, so it stops offering the link. */
export async function notifyCrmPortalRevogado(publicationId: string): Promise<boolean> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.KAUF_BRIDGE_SECRET;
  if (!url || !secret) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "portal_revogado", publicacao: { id: publicationId } }),
      signal: AbortSignal.timeout(8000), // a publicação não espera o CRM além disso
    });
    if (!res.ok) {
      logger.warn("CRM bridge: portal_revogado failed", { status: res.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("CRM bridge: portal_revogado error", { error: String(error) });
    return false;
  }
}
