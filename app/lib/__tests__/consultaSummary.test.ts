import { describe, it, expect } from "vitest";
import { isFullConsulta, consultaHas } from "../consultaSummary";
import type { Consulta, ConsultaSummary } from "../../types/clinical";

const full = {
  id: "c1",
  patientId: "p1",
  timestamp: "2026-10-01T12:00:00Z",
  inputs: { anamnese: "x", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
  outputs: { analise: "texto", conduta: "", receita: "r" },
  engineStatus: null,
  notes: "",
} as unknown as Consulta;

const summary: ConsultaSummary = {
  summary: true,
  id: "c2",
  patientId: "p1",
  timestamp: "2026-10-02T12:00:00Z",
  engineStatus: null as unknown as ConsultaSummary["engineStatus"],
  notes: "",
  hasAnalise: false,
  hasConduta: true,
  hasReceita: false,
};

describe("isFullConsulta", () => {
  it("distinguishes snapshots from sidebar summaries", () => {
    expect(isFullConsulta(full)).toBe(true);
    expect(isFullConsulta(summary)).toBe(false);
  });
});

describe("consultaHas", () => {
  it("reads outputs on full consultas", () => {
    expect(consultaHas(full, "analise")).toBe(true);
    expect(consultaHas(full, "conduta")).toBe(false);
    expect(consultaHas(full, "receita")).toBe(true);
  });

  it("reads the precomputed flags on summaries", () => {
    expect(consultaHas(summary, "analise")).toBe(false);
    expect(consultaHas(summary, "conduta")).toBe(true);
    expect(consultaHas(summary, "receita")).toBe(false);
  });

  it("tolerates a full consulta without outputs", () => {
    const bare = { ...full, outputs: undefined } as unknown as Consulta;
    expect(consultaHas(bare, "analise")).toBe(false);
  });
});
