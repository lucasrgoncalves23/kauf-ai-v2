import type { LabSeries } from "../labTrends";
import type { ParsedMedication, ScheduleDay } from "./extract";
import type { PortalContent, Slot } from "./schema";
import { normalizeForMatch } from "./validate";

export type PortalMedication = { slot: Slot; nome: string; dose: string; observacao?: string };
export type PortalSchedule = { introducao?: string; texto: string; dias: ScheduleDay[] | null };
export type PortalLabSeries = Omit<LabSeries, "patterns">;

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
export function mergeMedications(parsed: ParsedMedication[], ai: PortalContent["medicamentos"]): PortalMedication[] {
  return parsed.map((p) => {
    const note = ai.find((a) => sameMedication(a.nome, p.nome))?.observacao ?? p.observacao;
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
