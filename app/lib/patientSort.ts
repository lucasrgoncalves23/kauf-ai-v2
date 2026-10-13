import type { ConsultaEntry, PatientRecord } from "../types/clinical";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Epoch ms of the most recent consulta, or null when the patient has none. */
export function lastConsultaAt(consultas: ConsultaEntry[] | undefined): number | null {
  if (!consultas || consultas.length === 0) return null;
  let latest: number | null = null;
  for (const c of consultas) {
    const t = new Date(c.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (latest === null || t > latest) latest = t;
  }
  return latest;
}

export type RecencyBucket = {
  label: string;
  patients: PatientRecord[];
};

export const RECENCY_LABELS = {
  today: "Hoje",
  week: "Últimos 7 dias",
  month: "Últimos 30 dias",
  older: "Mais de 30 dias",
  none: "Sem consultas",
} as const;

function bucketFor(last: number, now: number): keyof typeof RECENCY_LABELS {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (last >= start.getTime()) return "today";
  const age = now - last;
  if (age < 7 * DAY_MS) return "week";
  if (age < 30 * DAY_MS) return "month";
  return "older";
}

/**
 * Groups patients by how recently they had a consulta: most recent first.
 * Patients without any consulta go in a final "Sem consultas" bucket sorted A–Z.
 * Empty buckets are omitted.
 */
export function groupByLastConsulta(
  patients: PatientRecord[],
  consultasMap: Record<string, ConsultaEntry[]>,
  now: number = Date.now()
): RecencyBucket[] {
  const stamped = patients.map((p) => ({ p, last: lastConsultaAt(consultasMap[p.id]) }));

  const withConsulta = stamped
    .filter((s): s is { p: PatientRecord; last: number } => s.last !== null)
    .sort((a, b) => b.last - a.last);
  const without = stamped
    .filter((s) => s.last === null)
    .map((s) => s.p)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));

  const order: (keyof typeof RECENCY_LABELS)[] = ["today", "week", "month", "older"];
  const groups: Record<string, PatientRecord[]> = {};
  for (const s of withConsulta) {
    const key = bucketFor(s.last, now);
    (groups[key] ||= []).push(s.p);
  }

  const result: RecencyBucket[] = [];
  for (const key of order) {
    if (groups[key]?.length) result.push({ label: RECENCY_LABELS[key], patients: groups[key] });
  }
  if (without.length) result.push({ label: RECENCY_LABELS.none, patients: without });
  return result;
}
