import { describe, it, expect } from "vitest";
import { checkClinicalRules, type ClinicalRule } from "../clinicalRules";

const FIXTURE_RULES: ClinicalRule[] = [
  { id: "R1", sex: "Feminino", forbiddenTerm: "suporte testicular" },
  { id: "R2", sex: "Masculino", forbiddenTerm: "suporte ovariano" },
  { id: "R3", sex: "Ambos", forbiddenTerm: "proibido para todos" },
];

describe("checkClinicalRules", () => {
  it("detects a forbidden term case-insensitively for the matching sex", () => {
    const violations = checkClinicalRules("Incluir SUPORTE TESTICULAR no plano.", "Feminino", FIXTURE_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule.id).toBe("R1");
  });

  it("does not match when the rule's sex differs from the patient's sex", () => {
    const violations = checkClinicalRules("Incluir suporte testicular no plano.", "Masculino", FIXTURE_RULES);
    expect(violations).toHaveLength(0);
  });

  it("does not match when the forbidden term is absent", () => {
    const violations = checkClinicalRules("Plano de sono e nutrição.", "Feminino", FIXTURE_RULES);
    expect(violations).toHaveLength(0);
  });

  it("detects multiple violations in the same text", () => {
    const text = "suporte testicular e também proibido para todos aqui.";
    const violations = checkClinicalRules(text, "Feminino", FIXTURE_RULES);
    expect(violations.map((v) => v.rule.id).sort()).toEqual(["R1", "R3"]);
  });

  it("applies 'Ambos' rules regardless of sex", () => {
    expect(checkClinicalRules("proibido para todos", "Masculino", FIXTURE_RULES)).toHaveLength(1);
    expect(checkClinicalRules("proibido para todos", "Feminino", FIXTURE_RULES)).toHaveLength(1);
  });

  it("returns no violations for empty text", () => {
    expect(checkClinicalRules("", "Feminino", FIXTURE_RULES)).toHaveLength(0);
  });
});
