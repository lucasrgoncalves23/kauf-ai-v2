import type { Consulta, EngineStatus } from "../types/clinical";
import {
  buildLabSeries,
  markerStatus,
  LAB_CATEGORIES,
  type LabMarkerKey,
  type LabSeries,
  type ClinicalData,
} from "./labTrends";

export type FollowUpInterval = {
  days: number;
  label: string;
  reason: string;
};

export type SuggestedLab = {
  marker: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type FollowUpRecommendation = {
  interval: FollowUpInterval;
  suggestedLabs: SuggestedLab[];
  lastConsultaDate: string | null;
  nextDate: string | null;
};

function phaseInterval(phase: string | undefined): FollowUpInterval {
  switch (phase) {
    case "A":
      return { days: 21, label: "2-3 semanas", reason: "Fase A — instabilidade autonômica requer acompanhamento próximo" };
    case "B":
      return { days: 35, label: "4-5 semanas", reason: "Fase B — otimização conservadora em andamento" };
    case "C":
      return { days: 75, label: "8-12 semanas", reason: "Fase C — métricas estáveis, manutenção" };
    default:
      return { days: 42, label: "4-6 semanas", reason: "Sem dados de fase — intervalo padrão" };
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function computeFollowUp(
  consultas: Consulta[],
  currentInputs: ClinicalData,
  engineStatus: EngineStatus,
): FollowUpRecommendation {
  const series = buildLabSeries(consultas, currentInputs.laboratoriais, currentInputs);
  const seriesMap = new Map<LabMarkerKey, LabSeries>(series.map((s) => [s.key, s]));

  let interval = phaseInterval(engineStatus?.phase);

  const outOfRange: { key: LabMarkerKey; label: string; status: "warning" | "critical" }[] = [];
  const trending: { key: LabMarkerKey; label: string; direction: "up" | "down" }[] = [];
  const missing: { label: string; category: string }[] = [];

  for (const s of series) {
    const latest = s.points[s.points.length - 1];
    const status = markerStatus(latest.value, s);
    if (status !== "normal") {
      outOfRange.push({ key: s.key, label: s.label, status });
    }

    if (s.points.length >= 2) {
      const prev = s.points[s.points.length - 2];
      const delta = latest.value - prev.value;
      const pctChange = Math.abs(delta) / prev.value;
      if (pctChange > 0.15) {
        const isGettingWorse =
          (s.refMax !== undefined && delta > 0 && latest.value > s.refMax) ||
          (s.refMin !== undefined && delta < 0 && latest.value < s.refMin);
        if (isGettingWorse) {
          trending.push({ key: s.key, label: s.label, direction: delta > 0 ? "up" : "down" });
        }
      }
    }
  }

  const coreMarkers: Record<string, string> = {
    glicose: "Glicose", hba1c: "HbA1c", insulina: "Insulina", homaIr: "HOMA-IR",
    tsh: "TSH", vitaminaD: "Vitamina D", ferritina: "Ferritina",
  };
  for (const [key, label] of Object.entries(coreMarkers)) {
    if (!seriesMap.has(key as LabMarkerKey)) {
      const cat = LAB_CATEGORIES.find((c) => c.markers.includes(key as LabMarkerKey));
      missing.push({ label, category: cat?.label || "" });
    }
  }

  if (outOfRange.some((m) => m.status === "critical")) {
    interval = { days: Math.min(interval.days, 14), label: "2 semanas", reason: "Marcadores em faixa crítica" };
  } else if (outOfRange.length > 0 || trending.length > 0) {
    interval = { days: Math.min(interval.days, 28), label: "3-4 semanas", reason: "Marcadores fora da faixa ou com tendência adversa" };
  }

  const suggestedLabs: SuggestedLab[] = [];

  for (const m of outOfRange) {
    suggestedLabs.push({
      marker: m.label,
      reason: m.status === "critical" ? "Fora da faixa — reavaliação urgente" : "Fora da faixa de referência",
      priority: m.status === "critical" ? "high" : "medium",
    });
  }

  for (const m of trending) {
    if (!suggestedLabs.some((s) => s.marker === m.label)) {
      suggestedLabs.push({
        marker: m.label,
        reason: `Tendência adversa (${m.direction === "up" ? "subindo" : "caindo"})`,
        priority: "medium",
      });
    }
  }

  for (const m of missing) {
    suggestedLabs.push({
      marker: m.label,
      reason: `Sem registro — solicitar${m.category ? ` (${m.category})` : ""}`,
      priority: "low",
    });
  }

  suggestedLabs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const sorted = [...consultas].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const lastDate = sorted[0]?.timestamp || null;
  const nextDate = lastDate ? addDays(lastDate, interval.days) : null;

  return { interval, suggestedLabs, lastConsultaDate: lastDate, nextDate };
}

export { formatDateBR };
