import rulesData from "./clinicalRules.json";

/**
 * Deterministic, non-LLM safety net. Prompt instructions guide the model's
 * judgment but don't guarantee compliance; these rules are authored by
 * Dr. Kaufmann and mechanically checked against the final generated text,
 * independent of whether the model followed its instructions.
 */
export type ClinicalRule = {
  id: string;
  sex: "Masculino" | "Feminino" | "Ambos";
  forbiddenTerm: string;
  notes?: string;
};

export type RuleViolation = {
  rule: ClinicalRule;
  matchedTerm: string;
};

export const CLINICAL_RULES: ClinicalRule[] = rulesData as ClinicalRule[];

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks generated text against the doctor-authored rule set for the given
 * patient sex. Pure and cheap enough to call on every render — never caches,
 * so it always reflects the current (possibly hand-edited) text.
 */
export function checkClinicalRules(
  text: string,
  sex: string,
  rules: ClinicalRule[] = CLINICAL_RULES
): RuleViolation[] {
  if (!text) return [];

  const violations: RuleViolation[] = [];
  for (const rule of rules) {
    if (rule.sex !== "Ambos" && rule.sex !== sex) continue;

    const pattern = new RegExp(`\\b${escapeRegExp(rule.forbiddenTerm)}\\b`, "i");
    const match = text.match(pattern);
    if (match) {
      violations.push({ rule, matchedTerm: match[0] });
    }
  }
  return violations;
}
