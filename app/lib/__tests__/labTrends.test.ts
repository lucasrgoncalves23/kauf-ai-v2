import { describe, it, expect } from "vitest";
import { extractLabValues, buildLabSeries, refRangeText, LAB_MARKERS } from "../labTrends";
import type { Consulta } from "../../types/clinical";

const SAMPLE_LAB_TEXT = `
HEMOGRAMA COMPLETO
Glicose de jejum: 92 mg/dL
Hemoglobina glicada (HbA1c): 5,4 %
Insulina basal: 8,2 µUI/mL
HOMA-IR: 1,9
Colesterol Total: 185 mg/dL
Colesterol LDL: 110 mg/dL
Colesterol HDL: 52 mg/dL
Triglicerídeos: 98 mg/dL
TSH ultra sensível: 2,1 mUI/L
T4 Livre: 1,3 ng/dL
Testosterona total: 540 ng/dL
Vitamina D (25-OH): 34 ng/mL
Vitamina B12: 480 pg/mL
Ferritina: 120 ng/mL
PCR-us: 0,8 mg/L
Creatinina: 0,9 mg/dL
`;

function makeConsulta(timestamp: string, laboratoriais: string): Consulta {
  return {
    id: `c_${timestamp}`,
    patientId: "p1",
    timestamp,
    inputs: { anamnese: "", bioimpedancia: "", laboratoriais, genetica: "", wearable: "" },
    outputs: { analise: "", conduta: "", receita: "" },
    engineStatus: null,
    notes: "",
  };
}

describe("extractLabValues", () => {
  it("extracts all markers from a realistic PT-BR lab report", () => {
    const values = extractLabValues(SAMPLE_LAB_TEXT);
    expect(values.glicose).toBe(92);
    expect(values.hba1c).toBe(5.4);
    expect(values.insulina).toBe(8.2);
    expect(values.homaIr).toBe(1.9);
    expect(values.colesterolTotal).toBe(185);
    expect(values.ldl).toBe(110);
    expect(values.hdl).toBe(52);
    expect(values.triglicerideos).toBe(98);
    expect(values.tsh).toBe(2.1);
    expect(values.t4Livre).toBe(1.3);
    expect(values.testosterona).toBe(540);
    expect(values.vitaminaD).toBe(34);
    expect(values.vitaminaB12).toBe(480);
    expect(values.ferritina).toBe(120);
    expect(values.pcr).toBe(0.8);
    expect(values.creatinina).toBe(0.9);
  });

  it("handles decimal dots as well as commas", () => {
    const values = extractLabValues("HbA1c: 5.7% / TSH: 3.25");
    expect(values.hba1c).toBe(5.7);
    expect(values.tsh).toBe(3.25);
  });

  it("rejects values outside plausibility bounds", () => {
    const values = extractLabValues("Glicose: 9999 mg/dL");
    expect(values.glicose).toBeUndefined();
  });

  it("does not match testosterona livre as total", () => {
    const values = extractLabValues("Testosterona livre: 12 pg/mL");
    expect(values.testosterona).toBeUndefined();
  });

  it("returns empty object for empty text", () => {
    expect(extractLabValues("")).toEqual({});
  });
});

describe("buildLabSeries", () => {
  it("builds chronological series across consultas", () => {
    const consultas = [
      makeConsulta("2026-06-01T10:00:00Z", "Glicose: 105 mg/dL"),
      makeConsulta("2026-01-15T10:00:00Z", "Glicose: 118 mg/dL"),
    ];
    const series = buildLabSeries(consultas, "");
    const glicose = series.find((s) => s.key === "glicose");
    expect(glicose).toBeDefined();
    expect(glicose!.points.map((p) => p.value)).toEqual([118, 105]); // oldest first
  });

  it("appends the current draft as 'Atual' when it differs", () => {
    const consultas = [makeConsulta("2026-06-01T10:00:00Z", "Glicose: 105 mg/dL")];
    const series = buildLabSeries(consultas, "Glicose: 92 mg/dL");
    const glicose = series.find((s) => s.key === "glicose")!;
    expect(glicose.points).toHaveLength(2);
    expect(glicose.points[1].label).toBe("Atual");
    expect(glicose.points[1].value).toBe(92);
  });

  it("skips the current draft when identical to the latest consulta", () => {
    const consultas = [makeConsulta("2026-06-01T10:00:00Z", "Glicose: 105 mg/dL")];
    const series = buildLabSeries(consultas, "Glicose: 105 mg/dL");
    const glicose = series.find((s) => s.key === "glicose")!;
    expect(glicose.points).toHaveLength(1);
  });

  it("omits markers with no datapoints", () => {
    const series = buildLabSeries([], "TSH: 2,0");
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe("tsh");
  });
});

describe("refRangeText", () => {
  it("formats two-sided, upper-only and lower-only ranges", () => {
    const glicose = LAB_MARKERS.find((m) => m.key === "glicose")!;
    const trigl = LAB_MARKERS.find((m) => m.key === "triglicerideos")!;
    const hdl = LAB_MARKERS.find((m) => m.key === "hdl")!;
    expect(refRangeText(glicose)).toBe("70–99 mg/dL");
    expect(refRangeText(trigl)).toBe("< 150 mg/dL");
    expect(refRangeText(hdl)).toBe("> 40 mg/dL");
  });
});
