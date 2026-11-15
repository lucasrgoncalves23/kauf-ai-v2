/**
 * CRM Bridge Webhook (inbound)
 *
 * Receives events from the Kaufmann Clinic OS CRM:
 * - paciente_upsert   → create/update a patient (booking via WhatsApp or
 *   manual registration). May include anamnese_preenchida (patient-filled
 *   intake form) — imported only when our anamnese is still empty, never
 *   overwriting the doctor's work.
 * - agenda_hoje       → today's appointment list (shown in the sidebar).
 * - alerta_clinico    → operational alert (e.g. Phase A patient without a
 *   scheduled return) surfaced to the doctor.
 * - briefing_pre_consulta → what the patient said on WhatsApp since the last
 *   consulta, summarized by the CRM. Stored in crm_briefings; the doctor adds
 *   it to the anamnese with one click (CrmInboxCard). Never injected into
 *   prompts by itself.
 * - exame_recebido    → an exam the patient sent on WhatsApp (base64, ≤4MB).
 *   Text is extracted (pdf-parse / Vision) into crm_exams; imported into the
 *   Laboratoriais layer only when it is empty — otherwise it waits for the
 *   doctor's click, never overwriting their work.
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
  insertCrmAlert,
  insertCrmBriefing,
  insertCrmExam,
  updatePatient,
  upsertCrmAgenda,
  type CrmAgendaAppointment,
} from "../../../lib/db";
import { MAX_EXAM_BYTES, extractExamText, isSupportedExamMime, normalizeMime } from "@/app/lib/examText";
import { formatImportedExam } from "@/app/lib/examFormat";
import { logger } from "@/app/lib/logger";
import type { PatientRecord } from "../../../types/clinical";

export const runtime = "nodejs";
// exame_recebido may call Claude Vision on a scanned PDF
export const maxDuration = 300;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  anamnese_preenchida?: string;
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

  let body: {
    type?: string;
    paciente?: CrmPatientPayload;
    date?: string;
    appointments?: CrmAgendaAppointment[];
    mensagem?: string;
    severidade?: string;
    // briefing_pre_consulta
    consulta_em?: string | null;
    periodo?: { de?: string; ate?: string };
    texto?: string;
    fontes?: { mensagens?: number; checkins?: number; intake?: boolean };
    // exame_recebido
    arquivo?: { nome?: string; mime?: string; tamanho?: number; base64?: string };
    legenda?: string | null;
    recebido_em?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (body.type === "paciente_upsert") {
    return handlePatientUpsert(body.paciente ?? {});
  }
  if (body.type === "agenda_hoje") {
    return handleAgendaHoje(body.date, body.appointments);
  }
  if (body.type === "alerta_clinico") {
    return handleAlertaClinico(body.paciente ?? {}, body.mensagem, body.severidade);
  }
  if (body.type === "briefing_pre_consulta") {
    return handleBriefing(body.paciente ?? {}, body.texto, body.consulta_em ?? null, body.periodo, body.fontes);
  }
  if (body.type === "exame_recebido") {
    return handleExameRecebido(body.paciente ?? {}, body.arquivo, body.legenda ?? null, body.recebido_em);
  }
  return NextResponse.json(
    { error: `Evento desconhecido: ${body.type}` },
    { status: 400 }
  );
}

async function handlePatientUpsert(p: CrmPatientPayload): Promise<NextResponse> {
  try {
    const existing = await findExisting(p);

    if (existing) {
      // anamnese preenchida pelo paciente: importa apenas se a nossa
      // estiver vazia — nunca sobrescreve o trabalho do médico
      let anamneseImportada: boolean | undefined;
      let inputs = undefined;
      if (p.anamnese_preenchida?.trim()) {
        if (!existing.inputs.anamnese?.trim()) {
          inputs = { ...existing.inputs, anamnese: p.anamnese_preenchida };
          anamneseImportada = true;
        } else {
          anamneseImportada = false;
        }
      }

      await updatePatient(existing.id, {
        name: p.nome ?? existing.name,
        ...(inputs ? { inputs } : {}),
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
        anamneseImportada,
      });
      return NextResponse.json({
        kauf_id: existing.id,
        ...(anamneseImportada !== undefined
          ? { anamnese_importada: anamneseImportada }
          : {}),
      });
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
      inputs: {
        anamnese: p.anamnese_preenchida ?? "",
        bioimpedancia: "",
        laboratoriais: "",
        genetica: "",
        wearable: "",
      },
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
    return NextResponse.json(
      {
        kauf_id: patient.id,
        ...(p.anamnese_preenchida ? { anamnese_importada: true } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("CRM bridge: upsert failed", { error: String(error) });
    return NextResponse.json({ error: "Falha no upsert" }, { status: 500 });
  }
}

async function handleAgendaHoje(
  date: string | undefined,
  appointments: CrmAgendaAppointment[] | undefined
): Promise<NextResponse> {
  if (!date || !Array.isArray(appointments)) {
    return NextResponse.json(
      { error: "Informe date e appointments" },
      { status: 422 }
    );
  }
  try {
    await upsertCrmAgenda(date, appointments);
    logger.info("CRM bridge: agenda do dia atualizada", {
      date,
      count: appointments.length,
    });
    return NextResponse.json({ ok: true, count: appointments.length });
  } catch (error) {
    logger.error("CRM bridge: falha na agenda_hoje", { error: String(error) });
    return NextResponse.json({ error: "Falha ao salvar agenda" }, { status: 500 });
  }
}

async function handleAlertaClinico(
  p: CrmPatientPayload,
  mensagem: string | undefined,
  severidade: string | undefined
): Promise<NextResponse> {
  if (!mensagem?.trim()) {
    return NextResponse.json({ error: "Informe mensagem" }, { status: 422 });
  }
  try {
    const existing = await findExisting(p);
    await insertCrmAlert({
      id: `crm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: existing?.id ?? null,
      patientName: existing?.name ?? p.nome ?? null,
      message: mensagem,
      severity: severidade ?? "media",
    });
    logger.info("CRM bridge: alerta clinico recebido", {
      patientId: existing?.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("CRM bridge: falha no alerta_clinico", { error: String(error) });
    return NextResponse.json({ error: "Falha ao salvar alerta" }, { status: 500 });
  }
}

async function handleBriefing(
  p: CrmPatientPayload,
  texto: string | undefined,
  consultaEm: string | null,
  periodo: { de?: string; ate?: string } | undefined,
  fontes: { mensagens?: number; checkins?: number; intake?: boolean } | undefined
): Promise<NextResponse> {
  if (!texto?.trim()) {
    return NextResponse.json({ error: "Informe texto" }, { status: 422 });
  }
  try {
    const existing = await findExisting(p);
    if (!existing) {
      return NextResponse.json(
        { error: "Paciente nao encontrado (kauf_id, cpf ou telefone)" },
        { status: 404 }
      );
    }
    const id = newId("brf");
    await insertCrmBriefing({
      id,
      patientId: existing.id,
      consultaEm: consultaEm && !isNaN(Date.parse(consultaEm)) ? consultaEm : null,
      periodoDe: periodo?.de && !isNaN(Date.parse(periodo.de)) ? periodo.de : null,
      periodoAte: periodo?.ate && !isNaN(Date.parse(periodo.ate)) ? periodo.ate : null,
      texto: texto.trim().slice(0, 20_000),
      fontes: fontes ?? {},
    });
    logger.info("CRM bridge: briefing recebido", { patientId: existing.id, chars: texto.length });
    return NextResponse.json({ ok: true, briefing_id: id }, { status: 201 });
  } catch (error) {
    logger.error("CRM bridge: falha no briefing_pre_consulta", { error: String(error) });
    return NextResponse.json({ error: "Falha ao salvar relato" }, { status: 500 });
  }
}

async function handleExameRecebido(
  p: CrmPatientPayload,
  arquivo: { nome?: string; mime?: string; tamanho?: number; base64?: string } | undefined,
  legenda: string | null,
  recebidoEm: string | undefined
): Promise<NextResponse> {
  if (!arquivo?.base64 || !arquivo.mime) {
    return NextResponse.json({ error: "Informe arquivo.base64 e arquivo.mime" }, { status: 422 });
  }
  const mime = normalizeMime(arquivo.mime);
  if (!isSupportedExamMime(mime)) {
    return NextResponse.json({ error: `Formato nao suportado: ${mime}` }, { status: 415 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(arquivo.base64, "base64");
  } catch {
    return NextResponse.json({ error: "base64 invalido" }, { status: 422 });
  }
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "Arquivo vazio" }, { status: 422 });
  }
  if (buffer.byteLength > MAX_EXAM_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (max 4MB)" }, { status: 413 });
  }

  try {
    const existing = await findExisting(p);
    if (!existing) {
      return NextResponse.json(
        { error: "Paciente nao encontrado (kauf_id, cpf ou telefone)" },
        { status: 404 }
      );
    }

    const extraction = await extractExamText(buffer, mime);
    if (!extraction.ok) {
      logger.warn("CRM bridge: extracao do exame falhou", { patientId: existing.id, error: extraction.error });
      return NextResponse.json({ error: extraction.error }, { status: extraction.status });
    }

    const receivedAt = recebidoEm && !isNaN(Date.parse(recebidoEm)) ? recebidoEm : new Date().toISOString();
    const id = newId("exm");

    // importa sozinho só quando a camada está vazia — nunca por cima do médico
    const layerEmpty = !existing.inputs.laboratoriais?.trim();
    let importedAt: string | null = null;
    if (layerEmpty) {
      await updatePatient(existing.id, {
        inputs: { ...existing.inputs, laboratoriais: formatImportedExam(extraction.text, receivedAt, legenda) },
      });
      importedAt = new Date().toISOString();
    }

    await insertCrmExam({
      id,
      patientId: existing.id,
      filename: arquivo.nome ?? null,
      mime,
      sizeBytes: buffer.byteLength,
      caption: legenda,
      texto: extraction.text,
      method: extraction.method,
      recebidoEm: receivedAt,
      importedAt,
    });
    logger.info("CRM bridge: exame recebido", {
      patientId: existing.id,
      method: extraction.method,
      chars: extraction.text.length,
      importado: !!importedAt,
    });
    return NextResponse.json(
      { ok: true, exam_id: id, importado: !!importedAt, caracteres: extraction.text.length, metodo: extraction.method },
      { status: 201 }
    );
  } catch (error) {
    logger.error("CRM bridge: falha no exame_recebido", { error: String(error) });
    return NextResponse.json({ error: "Falha ao processar exame" }, { status: 500 });
  }
}
