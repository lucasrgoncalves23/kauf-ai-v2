import { describe, it, expect } from "vitest";
import { runEngine } from "../engine";
import type { ClinicalInput } from "@/app/types/clinical";

function makeInput(overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return {
    base: { chiefComplaint: "Fadiga crônica" },
    ...overrides,
  };
}

describe("decidePhase (via runEngine)", () => {
  it("returns Phase A when HRV is down and RHR is up", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "down", rhrTrend: "up" } })
    );
    expect(result.decision.phase).toBe("A");
  });

  it("returns Phase B by default (conservative)", () => {
    const result = runEngine(makeInput());
    expect(result.decision.phase).toBe("B");
  });

  it("returns Phase B when only HRV is down (not both signals)", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "down", rhrTrend: "stable" } })
    );
    expect(result.decision.phase).toBe("B");
  });

  it("returns Phase B when only RHR is up (not both signals)", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "stable", rhrTrend: "up" } })
    );
    expect(result.decision.phase).toBe("B");
  });

  it("returns Phase B when both trends are stable", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "stable", rhrTrend: "stable" } })
    );
    expect(result.decision.phase).toBe("B");
  });

  it("respects explicit phase override to A", () => {
    const result = runEngine(makeInput({ phaseAssumption: "A" }));
    expect(result.decision.phase).toBe("A");
    expect(result.decision.rationale[0]).toContain("override");
  });

  it("respects explicit phase override to C", () => {
    const result = runEngine(makeInput({ phaseAssumption: "C" }));
    expect(result.decision.phase).toBe("C");
  });

  it("override beats wearable signals", () => {
    const result = runEngine(
      makeInput({
        phaseAssumption: "C",
        wearable: { hrvTrend: "down", rhrTrend: "up" },
      })
    );
    expect(result.decision.phase).toBe("C");
  });

  it("returns Phase B when wearable data is absent", () => {
    const result = runEngine(makeInput({ wearable: undefined }));
    expect(result.decision.phase).toBe("B");
  });
});

describe("runEngine alerts", () => {
  it("generates HRV alert when HRV trend is down", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "down", rhrTrend: "stable" } })
    );
    expect(result.decision.alerts).toContain("HRV em queda (tendência)");
  });

  it("generates RHR alert when RHR trend is up", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "stable", rhrTrend: "up" } })
    );
    expect(result.decision.alerts).toContain("RHR em elevação (tendência)");
  });

  it("generates both alerts for Phase A pattern", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "down", rhrTrend: "up" } })
    );
    expect(result.decision.alerts).toHaveLength(2);
  });

  it("generates no alerts when trends are stable", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "stable", rhrTrend: "stable" } })
    );
    expect(result.decision.alerts).toHaveLength(0);
  });
});

describe("runEngine report structure", () => {
  it("report contains all 9 program keys", () => {
    const result = runEngine(makeInput());
    const programs = Object.keys(result.report.programas);
    expect(programs).toEqual([
      "Sono",
      "Nutrição",
      "Exercício",
      "Suplementação",
      "Manipulados",
      "Soroterapia",
      "Metabolismo / GLP-1",
      "Hormonal",
      "Peptídeos",
    ]);
  });

  it("Phase A report marks Camada 3 as BLOQUEADA", () => {
    const result = runEngine(
      makeInput({ wearable: { hrvTrend: "down", rhrTrend: "up" } })
    );
    expect(result.report.camadasAtivas).toContain("BLOQUEADA");
  });

  it("Phase B report marks Camada 3 as CONDICIONAL", () => {
    const result = runEngine(makeInput());
    expect(result.report.camadasAtivas).toContain("CONDICIONAL");
  });

  it("inputsUsed reflects the input data", () => {
    const input = makeInput({ phaseAssumption: "A" });
    const result = runEngine(input);
    expect(result.decision.inputsUsed.phaseAssumption).toBe("A");
    expect(result.decision.inputsUsed.chiefComplaint).toBe("Fadiga crônica");
  });
});
