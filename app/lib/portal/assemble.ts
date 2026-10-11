// Server-only: loads everything a publication needs from the DB and assembles the payload.
import type { Consulta, PatientRecord } from "../../types/clinical";
import { getConsultas, getPatient } from "../db";
import { buildLabSeries, markerStatus, type LabSeries } from "../labTrends";
import { computeFollowUp, type FollowUpRecommendation } from "../followUp";
import { checkClinicalRules } from "../clinicalRules";
import { isValidCpf, normalizeCpf } from "../cpf";
import { CLINIC, getClinicContactLine } from "../clinic";
import { extractThirtyDayBlocks, parseCronograma, parseDays, parseReceitaItems, type ParsedMedication } from "./extract";
import { flattenContentText, type PortalContent } from "./schema";
import { unverifiedDoseMentions } from "./validate";
import { firstName, mergeMedications, toPortalLabSeries, type PortalPayload } from "./payload";

export const PUBLICATION_DAYS = 90;

export class PortalPublishError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "PortalPublishError";
  }
}

export type PublishContext = {
  patient: PatientRecord;
  consulta: Consulta;
  consultas: Consulta[];
  labSeries: LabSeries[];
  followUp: FollowUpRecommendation;
  cpfDigits: string;
  sex: string;
  age: string;
  firstName: string;
};

export type DerivedParts = {
  analise: string;
  condutaSemPlanos: string;
  receita: string;
  dieta?: string;
  treino?: string;
  parsedMedications: ParsedMedication[];
};

export async function loadPublishContext(patientId: string, consultaId: string): Promise<PublishContext> {
  const patient = await getPatient(patientId);
  if (!patient || patient.deletedAt) throw new PortalPublishError("Paciente não encontrado.", 404);

  const cpfDigits = normalizeCpf(patient.profile?.cpf);
  if (!isValidCpf(cpfDigits)) {
    throw new PortalPublishError("O CPF do paciente está ausente ou inválido. Corrija no cadastro antes de publicar.", 422);
  }

  const consultas = await getConsultas(patientId);
  const consulta = consultas.find((c) => c.id === consultaId);
  if (!consulta) throw new PortalPublishError("Consulta não encontrada. Salve a consulta antes de publicar.", 404);

  const labSeries = buildLabSeries(consultas, consulta.inputs?.laboratoriais || "", consulta.inputs);
  const followUp = computeFollowUp(consultas, consulta.inputs, consulta.engineStatus);

  return {
    patient,
    consulta,
    consultas,
    labSeries,
    followUp,
    cpfDigits,
    sex: patient.profile?.sex || "",
    age: patient.profile?.age || "",
    firstName: firstName(patient.profile?.name || patient.name),
  };
}

export function deriveParts(consulta: Consulta): DerivedParts {
  const analise = consulta.outputs?.analise || "";
  const conduta = consulta.outputs?.conduta || "";
  const receita = consulta.outputs?.receita || "";
  if (!analise && !conduta) throw new PortalPublishError("A consulta não tem análise nem conduta para publicar.", 422);
  if (!receita.trim()) {
    throw new PortalPublishError("A consulta não tem receita. Gere a receita e salve a consulta antes de publicar — o que o paciente toma vem só da receita.", 422);
  }

  const blocks = extractThirtyDayBlocks(conduta);
  const parsedMedications = parseCronograma(receita) ?? parseReceitaItems(receita);
  return { analise, condutaSemPlanos: blocks.condutaSemPlanos, receita, dieta: blocks.dieta, treino: blocks.treino, parsedMedications };
}

/** Rule gate on what the patient would see: sources, verbatim blocks and the AI text. */
export function checkRules(parts: DerivedParts, content: PortalContent | null, sex: string): string[] {
  const texts = [parts.analise, parts.condutaSemPlanos, parts.receita, parts.dieta ?? "", parts.treino ?? ""];
  if (content) texts.push(flattenContentText(content));
  const seen = new Set<string>();
  for (const text of texts) {
    for (const v of checkClinicalRules(text, sex)) seen.add(`"${v.matchedTerm}" (regra ${v.rule.id})`);
  }
  return [...seen];
}

/** Safety gate on AI content. Returns the content restricted to markers the patient actually has. */
export function validateContent(raw: PortalContent, parts: DerivedParts, labSeries: LabSeries[], sex: string): PortalContent {
  // Explanations for markers without results would never render; drop them rather than fail
  const known = new Set<string>(labSeries.map((s) => s.key));
  const content: PortalContent = { ...raw, exames: raw.exames.filter((e) => known.has(e.marcador)) };

  const violations = checkRules(parts, content, sex);
  if (violations.length) {
    throw new PortalPublishError(`Bloqueado pelas regras clínicas: ${violations.join(", ")}.`, 422);
  }

  const source = `${parts.receita}\n${parts.condutaSemPlanos}\n${parts.dieta ?? ""}\n${parts.treino ?? ""}`;
  const unverified = unverifiedDoseMentions(flattenContentText(content), source);
  if (unverified.length) {
    throw new PortalPublishError(
      `Bloqueado: o texto explicativo da IA citou doses que não estão escritas assim na receita/conduta (${unverified.join("; ")}). Gere novamente.`,
      422
    );
  }

  return content;
}

export function assemblePayload(input: {
  context: PublishContext;
  parts: DerivedParts;
  content: PortalContent;
  publishedAt: string;
  expiresAt: string;
}): PortalPayload {
  const { context, parts, content } = input;
  const contactLine = getClinicContactLine();
  if (!contactLine) {
    throw new PortalPublishError("CLINIC_CONTACT_LINE não configurado no servidor. O portal precisa de um contato da clínica.", 503);
  }

  const schedule = (texto: string | undefined, introducao: string | undefined) =>
    texto ? { introducao, texto, dias: parseDays(texto) } : undefined;

  return {
    version: 1,
    publishedAt: input.publishedAt,
    expiresAt: input.expiresAt,
    patientFirstName: context.firstName,
    consultaDate: context.consulta.timestamp,
    clinic: { doctor: CLINIC.doctor, crm: CLINIC.crm, name: CLINIC.name, contactLine },
    content,
    medicamentos: mergeMedications(parts.parsedMedications, content.medicamentos),
    schedules: {
      dieta: schedule(parts.dieta, content.dieta?.introducao),
      treino: schedule(parts.treino, content.treino?.introducao),
    },
    receitaOriginal: parts.receita,
    labSeries: toPortalLabSeries(context.labSeries),
    nextVisit: {
      date: context.followUp.nextDate,
      label: context.followUp.interval.label,
      reason: context.followUp.interval.reason,
    },
  };
}

/** Compact lab summary for the prompt: no raw text, just what the AI must explain. */
export function labSummaryForPrompt(labSeries: LabSeries[]): string {
  if (!labSeries.length) return "(nenhum exame reconhecido)";
  return labSeries
    .map((s) => {
      const latest = s.points[s.points.length - 1];
      const prev = s.points.length > 1 ? s.points[s.points.length - 2] : null;
      const trend = prev ? (latest.value > prev.value ? "subiu" : latest.value < prev.value ? "caiu" : "estável") : "primeiro registro";
      const ref = s.refMin !== undefined && s.refMax !== undefined ? `${s.refMin}-${s.refMax}` : s.refMax !== undefined ? `< ${s.refMax}` : s.refMin !== undefined ? `> ${s.refMin}` : "sem referência";
      return `- ${s.key} (${s.label}): ${latest.value} ${s.unit} | ref ${ref} | ${markerStatus(latest.value, s)} | ${trend}`;
    })
    .join("\n");
}

export function expiryFrom(now: Date): string {
  return new Date(now.getTime() + PUBLICATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
