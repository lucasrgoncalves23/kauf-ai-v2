/**
 * CRM Bridge Webhook (inbound)
 *
 * Receives patient upserts from the Kaufmann Clinic OS CRM:
 * - a patient books an appointment via WhatsApp, or
 * - a patient is manually registered in the CRM panel.
 *
 * Auth: Authorization: Bearer <KAUF_BRIDGE_SECRET> (shared with the CRM).
 * Matching order: kauf_id (our id) → cpf → phone. Creates the patient
 * folder when no match is found. Responds { kauf_id } so the CRM can
 * store the link.
 */

import { NextResponse } from "next/server";
import {
  createPatient,
  findPatientByCpf,
  findPatientByPhone,
  getPatient,
  updatePatient,
} from "../../../lib/db";
import { logger } from "@/app/lib/logger";
import type { PatientRecord } from "../../../types/clinical";

export const runtime = "nodejs";

type CrmPatientPayload = {
  crm_id?: string;
  kauf_id?: string | null;
  nome?: string;
  telefone?: string;
  cpf?: string;
  nascimento?: string;
  email?: string;
  etapa?: string;
  tags?: string[];
};

function verifyBridgeSecret(request: Request): boolean {
  const secret = process.env.KAUF_BRIDGE_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function findExisting(p: CrmPatientPayload): Promise<PatientRecord | null> {
  if (p.kauf_id) {
    const byId = await getPatient(p.kauf_id);
    if (byId && !byId.deletedAt) return byId;
  }
  if (p.cpf) {
    const byCpf = await findPatientByCpf(p.cpf);
    if (byCpf) return byCpf;
  }
  if (p.telefone) {
    const byPhone = await findPatientByPhone(p.telefone);
    if (byPhone) return byPhone;
  }
  return null;
}

export async function POST(request: Request) {
  if (!verifyBridgeSecret(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  let body: { type?: string; paciente?: CrmPatientPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (body.type !== "paciente_upsert") {
    return NextResponse.json(
      { error: `Evento desconhecido: ${body.type}` },
      { status: 400 }
    );
  }

  const p = body.paciente ?? {};

  try {
    const existing = await findExisting(p);

    if (existing) {
      await updatePatient(existing.id, {
        name: p.nome ?? existing.name,
        profile: {
          ...existing.profile,
          name: p.nome ?? existing.profile.name,
          cpf: p.cpf ?? existing.profile.cpf,
          birthDate: p.nascimento ?? existing.profile.birthDate,
          phone: p.telefone ?? existing.profile.phone,
        },
      });
      logger.info("CRM bridge: patient updated", {
        patientId: existing.id,
        crmId: p.crm_id,
      });
      return NextResponse.json({ kauf_id: existing.id });
    }

    if (!p.nome?.trim()) {
      return NextResponse.json(
        { error: "Informe paciente.nome para criar" },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const patient: PatientRecord = {
      id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: p.nome.trim(),
      createdAt: now,
      updatedAt: now,
      inputs: { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
      outputs: { analise: "", conduta: "", receita: "" },
      profile: {
        name: p.nome.trim(),
        age: "",
        sex: "",
        cpf: p.cpf ?? "",
        birthDate: p.nascimento ?? "",
        phone: p.telefone ?? "",
      },
      chatMessages: [],
      engineStatus: null,
    };
    await createPatient(patient);
    logger.info("CRM bridge: patient created", {
      patientId: patient.id,
      crmId: p.crm_id,
    });
    return NextResponse.json({ kauf_id: patient.id }, { status: 201 });
  } catch (error) {
    logger.error("CRM bridge: upsert failed", { error: String(error) });
    return NextResponse.json({ error: "Falha no upsert" }, { status: 500 });
  }
}
