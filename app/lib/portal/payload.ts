import type { LabSeries } from "../labTrends";
import type { ParsedMedication, ScheduleDay } from "./extract";
import type { PortalContent, Slot } from "./schema";
import { normalizeForMatch } from "./validate";

export type PortalMedication = { slot: Slot; nome: string; dose: string; observacao?: string };
export type PortalSchedule = { introducao?: string; texto: string; dias: ScheduleDay[] | null };
export type PortalLabSeries = Omit<LabSeries, "patterns">;

export type PortalSignature = {
  signer: string;
  crm: string;
  signedAt: string;
  /** SHA-256 (hex) of the canonical payload without this field */
  hash: string;
  /** Short human-readable form of the hash, printed for the patient */
  code: string;
  /** Hand-drawn signature, PNG data URL */
  image: string;
};

export type PortalPayload = {
  version: 1;
  publishedAt: string;
  expiresAt: string;
  patientFirstName: string;
  consultaDate: string;
  clinic: { doctor: string; crm: string; name: string; contactLine: string };
  content: PortalContent;
  medicamentos: PortalMedication[];
  schedules: { dieta?: PortalSchedule; treino?: PortalSchedule };
  receitaOriginal: string;
  labSeries: PortalLabSeries[];
  nextVisit: { date: string | null; label: string; reason: string };
  signature?: PortalSignature;
};

export function firstName(fullName: string): string {
  return (fullName || "").trim().split(/\s+/)[0] || "Paciente";
}

function sameMedication(a: string, b: string): boolean {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 4 && long.includes(short);
}

/**
 * Names, doses and times come only from the receita parser; the AI contributes at most a
 * plain-language note per item. AI entries that match no parsed item are dropped.
 */
export function mergeMedications(
  parsed: ParsedMedication[],
  ai: PortalContent["medicamentos"],
  opts: { edited?: boolean } = {}
): PortalMedication[] {
  return parsed.map((p) => {
    const match = ai.find((a) => sameMedication(a.nome, p.nome));
    // Doctor-edited notes are authoritative, so a deleted note stays deleted; the receita's own note
    // only fills items the edited content doesn't cover (e.g. added to the receita after editing)
    const note = opts.edited && match ? match.observacao : (match?.observacao ?? p.observacao);
    // A note that only repeats the receita line adds nothing
    const observacao = note && normalizeForMatch(note) !== normalizeForMatch(p.dose) ? note : undefined;
    return observacao ? { ...p, observacao } : { slot: p.slot, nome: p.nome, dose: p.dose };
  });
}

export function toPortalLabSeries(series: LabSeries[]): PortalLabSeries[] {
  return series.map(({ patterns: _patterns, ...rest }) => {
    void _patterns;
    return rest;
  });
}

/**
 * One note entry per item the patient will see, keyed by the parsed (receita) name, so the
 * editor can edit notes item by item and the server merge matches them exactly.
 */
export function alignMedicationNotes(content: PortalContent, medicamentos: PortalMedication[]): PortalContent {
  return {
    ...content,
    medicamentos: medicamentos.map((m) => (m.observacao ? { nome: m.nome, observacao: m.observacao } : { nome: m.nome })),
  };
}

/** Client-side mirror of the server assembly for the live preview; the server rebuilds it on publish. */
export function applyContent(base: PortalPayload, content: PortalContent): PortalPayload {
  const intro = (key: "dieta" | "treino") => {
    const schedule = base.schedules[key];
    return schedule ? { ...schedule, introducao: content[key]?.introducao } : undefined;
  };
  return {
    ...base,
    content,
    medicamentos: mergeMedications(
      base.medicamentos.map((m) => ({ slot: m.slot, nome: m.nome, dose: m.dose })),
      content.medicamentos,
      { edited: true }
    ),
    schedules: { dieta: intro("dieta"), treino: intro("treino") },
  };
}
