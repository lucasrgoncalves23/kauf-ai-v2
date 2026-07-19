// Lab marker extraction + per-patient evolution series across consultas.
// Extraction follows the same regex conventions as extraction.ts
// (Portuguese lab reports, decimal comma or dot).

import type { Consulta } from "../types/clinical";

export type LabMarkerKey =
  | "glicose"
  | "hba1c"
  | "insulina"
  | "homaIr"
  | "colesterolTotal"
  | "ldl"
  | "hdl"
  | "triglicerideos"
  | "tsh"
  | "t4Livre"
  | "testosterona"
  | "vitaminaD"
  | "vitaminaB12"
  | "ferritina"
  | "pcr"
  | "creatinina";

export type LabMarkerSpec = {
  key: LabMarkerKey;
  label: string;
  unit: string;
  /** Plausibility bounds — values outside are treated as extraction noise. */
  min: number;
  max: number;
  /** Reference range for display (either bound optional). */
  refMin?: number;
  refMax?: number;
  patterns: RegExp[];
};

const NUM = "(\\d+(?:[.,]\\d+)?)";

export const LAB_MARKERS: LabMarkerSpec[] = [
  {
    key: "glicose", label: "Glicose", unit: "mg/dL", min: 30, max: 500, refMin: 70, refMax: 99,
    patterns: [
      new RegExp(`glicose\\s*(?:de\\s*jejum|em\\s*jejum|jejum)?[:\\s]*${NUM}`, "i"),
      new RegExp(`glicemia\\s*(?:de\\s*jejum|em\\s*jejum|jejum)?[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "hba1c", label: "HbA1c", unit: "%", min: 3, max: 15, refMin: 4, refMax: 5.6,
    patterns: [
      new RegExp(`hba1c\\)?[:\\s]*${NUM}`, "i"),
      new RegExp(`hemoglobina\\s*glicada\\s*(?:\\([^)]*\\))?[:\\s]*${NUM}`, "i"),
      new RegExp(`\\ba1c[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "insulina", label: "Insulina", unit: "µUI/mL", min: 0.5, max: 300, refMin: 2, refMax: 25,
    patterns: [new RegExp(`insulina\\s*(?:de\\s*jejum|jejum|basal)?[:\\s]*${NUM}`, "i")],
  },
  {
    key: "homaIr", label: "HOMA-IR", unit: "", min: 0.1, max: 20, refMax: 2.5,
    patterns: [
      new RegExp(`homa[\\s-]*ir[:\\s]*${NUM}`, "i"),
      new RegExp(`índice\\s*homa[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "colesterolTotal", label: "Colesterol Total", unit: "mg/dL", min: 50, max: 500, refMax: 190,
    patterns: [new RegExp(`colesterol\\s*total[:\\s]*${NUM}`, "i")],
  },
  {
    key: "ldl", label: "LDL", unit: "mg/dL", min: 20, max: 400, refMax: 130,
    patterns: [new RegExp(`(?:colesterol\\s*)?ldl(?:[\\s-]*c)?[:\\s]*${NUM}`, "i")],
  },
  {
    key: "hdl", label: "HDL", unit: "mg/dL", min: 10, max: 150, refMin: 40,
    patterns: [new RegExp(`(?:colesterol\\s*)?hdl(?:[\\s-]*c)?[:\\s]*${NUM}`, "i")],
  },
  {
    key: "triglicerideos", label: "Triglicerídeos", unit: "mg/dL", min: 20, max: 2000, refMax: 150,
    patterns: [
      new RegExp(`triglicer[íi]d(?:eo|io)s?[:\\s]*${NUM}`, "i"),
      new RegExp(`\\btg[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "tsh", label: "TSH", unit: "mUI/L", min: 0.01, max: 100, refMin: 0.4, refMax: 4,
    patterns: [new RegExp(`tsh(?:\\s*ultra[\\s-]*sens[íi]vel)?[:\\s]*${NUM}`, "i")],
  },
  {
    key: "t4Livre", label: "T4 Livre", unit: "ng/dL", min: 0.1, max: 10, refMin: 0.8, refMax: 1.8,
    patterns: [new RegExp(`t4\\s*livre[:\\s]*${NUM}`, "i")],
  },
  {
    key: "testosterona", label: "Testosterona Total", unit: "ng/dL", min: 20, max: 3000, refMin: 300, refMax: 1000,
    patterns: [new RegExp(`testosterona\\s*(?!livre)(?:total)?[:\\s]*${NUM}`, "i")],
  },
  {
    key: "vitaminaD", label: "Vitamina D", unit: "ng/mL", min: 3, max: 200, refMin: 30, refMax: 100,
    patterns: [
      new RegExp(`vitamina\\s*d3?\\s*(?:\\([^)]*\\))?[:\\s]*${NUM}`, "i"),
      new RegExp(`25[\\s-]*(?:oh|hidroxi)[\\s-]*(?:vitamina\\s*)?d3?[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "vitaminaB12", label: "Vitamina B12", unit: "pg/mL", min: 50, max: 3000, refMin: 200, refMax: 900,
    patterns: [
      new RegExp(`vitamina\\s*b[\\s-]*12[:\\s]*${NUM}`, "i"),
      new RegExp(`cobalamina[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "ferritina", label: "Ferritina", unit: "ng/mL", min: 1, max: 5000, refMin: 30, refMax: 300,
    patterns: [new RegExp(`ferritina[:\\s]*${NUM}`, "i")],
  },
  {
    key: "pcr", label: "PCR-us", unit: "mg/L", min: 0.01, max: 300, refMax: 5,
    patterns: [
      new RegExp(`pcr[\\s-]*(?:us|ultra[\\s-]*sens[íi]vel)?[:\\s]*${NUM}`, "i"),
      new RegExp(`prote[íi]na\\s*c\\s*reativa\\s*(?:\\([^)]*\\))?[:\\s]*${NUM}`, "i"),
    ],
  },
  {
    key: "creatinina", label: "Creatinina", unit: "mg/dL", min: 0.2, max: 15, refMin: 0.7, refMax: 1.3,
    patterns: [new RegExp(`creatinina[:\\s]*${NUM}`, "i")],
  },
];

function parseNumber(str: string): number {
  return parseFloat(str.replace(",", "."));
}

/** Extract all recognized lab values from free lab-report text. */
export function extractLabValues(text: string): Partial<Record<LabMarkerKey, number>> {
  const result: Partial<Record<LabMarkerKey, number>> = {};
  if (!text) return result;

  for (const marker of LAB_MARKERS) {
    for (const pattern of marker.patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = parseNumber(match[1]);
        if (!isNaN(value) && value >= marker.min && value <= marker.max) {
          result[marker.key] = value;
          break;
        }
      }
    }
  }

  return result;
}

export type LabPoint = {
  /** ISO timestamp of the consulta (or now for the current draft). */
  timestamp: string;
  /** Short display label, e.g. "12/03/26" or "Atual". */
  label: string;
  value: number;
  isCurrent?: boolean;
};

export type LabSeries = LabMarkerSpec & { points: LabPoint[] };

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "?";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * Build per-marker evolution series from a patient's saved consultas plus the
 * current (possibly unsaved) lab text. Markers with no datapoints are omitted.
 */
export function buildLabSeries(consultas: Consulta[], currentLabText: string): LabSeries[] {
  const sorted = [...consultas].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const byMarker = new Map<LabMarkerKey, LabPoint[]>();

  for (const consulta of sorted) {
    const values = extractLabValues(consulta.inputs?.laboratoriais || "");
    for (const [key, value] of Object.entries(values) as [LabMarkerKey, number][]) {
      const points = byMarker.get(key) || [];
      points.push({ timestamp: consulta.timestamp, label: shortDate(consulta.timestamp), value });
      byMarker.set(key, points);
    }
  }

  // Current draft labs: only add when they differ from the latest saved point
  // (otherwise a just-saved consulta would show twice)
  const currentValues = extractLabValues(currentLabText || "");
  for (const [key, value] of Object.entries(currentValues) as [LabMarkerKey, number][]) {
    const points = byMarker.get(key) || [];
    const last = points[points.length - 1];
    if (!last || last.value !== value) {
      points.push({
        timestamp: new Date().toISOString(),
        label: "Atual",
        value,
        isCurrent: true,
      });
      byMarker.set(key, points);
    }
  }

  return LAB_MARKERS.filter((m) => byMarker.has(m.key)).map((m) => ({
    ...m,
    points: byMarker.get(m.key)!,
  }));
}

/** Human-readable reference range, e.g. "70–99 mg/dL" or "< 150 mg/dL". */
export function refRangeText(marker: LabMarkerSpec): string {
  const unit = marker.unit ? ` ${marker.unit}` : "";
  if (marker.refMin !== undefined && marker.refMax !== undefined) {
    return `${marker.refMin}–${marker.refMax}${unit}`;
  }
  if (marker.refMax !== undefined) return `< ${marker.refMax}${unit}`;
  if (marker.refMin !== undefined) return `> ${marker.refMin}${unit}`;
  return "";
}
