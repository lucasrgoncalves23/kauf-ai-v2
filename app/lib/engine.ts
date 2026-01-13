// app/lib/engine.ts
import type { ClinicalInput, Phase } from "@/app/types/clinical";

import { PHASE_RULES, PROGRAM_BLOCKS, KPI_TEMPLATE } from "@/app/lib/kaufmannSpec";


export type BlockedModule = "Hormonal" | "Peptídeos" | "Metabolismo / GLP-1";

export type EngineDecision = {
  phase: Phase;
  blocked: { module: BlockedModule; reason: string }[];
  alerts: string[];
};

export type GeneratedReport = {
  diagnosticoIntegrativo: string;
  gargaloPrimario: string;
  camadasAtivas: string; // multiline
  programas: Record<string, string>; // program name -> text
  kpis: string; // multiline 30/60/90
};

function decidePhase(input: ClinicalInput): Phase {
  // If you explicitly set a phase, we respect it for now.
  if (input.phaseAssumption) return input.phaseAssumption;

  // Minimal observed pattern: autonomic instability => Phase A
  const hrvDown = input.wearable?.hrvTrend === "down";
  const rhrUp = input.wearable?.rhrTrend === "up";
  if (hrvDown && rhrUp) return "A";

  // Default conservative if unknown (keeps advanced tools locked)
  return "B";
}

export function runEngine(input: ClinicalInput): {
  decision: EngineDecision;
  report: GeneratedReport;
} {
  const phase = decidePhase(input);

  const alerts: string[] = [];
  const blocked: { module: BlockedModule; reason: string }[] = [];

  const hrvDown = input.wearable?.hrvTrend === "down";
  const rhrUp = input.wearable?.rhrTrend === "up";

  if (hrvDown) alerts.push("HRV em queda (tendência)");
  if (rhrUp) alerts.push("RHR em elevação (tendência)");

const rules = PHASE_RULES[phase];

const maybeBlock = (name: string, reason: string) => {
  if (name === "Hormonal") blocked.push({ module: "Hormonal", reason });
  if (name === "Peptídeos") blocked.push({ module: "Peptídeos", reason });
  if (name === "Metabolismo / GLP-1") blocked.push({ module: "Metabolismo / GLP-1", reason });
};

for (const p of rules.blockedPrograms) {
  maybeBlock(p, `Bloqueado por fase (${phase}): ${rules.description}`);
}


  // Report: we generate structure + placeholders, not therapies.
  const report: GeneratedReport = {
    diagnosticoIntegrativo:
      `Contexto: ${input.base.chiefComplaint}\n` +
      `Hipótese operacional: organizar base biológica → reduzir ruído fisiológico → só então otimizar.`,
    gargaloPrimario:
      phase === "A"
        ? "Excesso de estímulo / instabilidade autonômica (prioridade: recuperação)."
        : "Definir gargalo dominante com base em dados completos (sono, carga, metabolismo, sintomas).",
    camadasAtivas:
      phase === "A"
        ? "Camada 1 — Base Biológica (ATIVA)\nCamada 2 — Performance/Metabolismo (MODERADA)\nCamada 3 — Hormonal (BLOQUEADA)\nCamada 4 — Recuperação (ATIVA)"
        : phase === "B"
        ? "Camada 1 — Base Biológica (ATIVA)\nCamada 2 — Performance/Metabolismo (ATIVA)\nCamada 3 — Hormonal (CONDICIONAL)\nCamada 4 — Recuperação (ATIVA)"
        : "Camada 1 — Base Biológica (MANUTENÇÃO)\nCamada 2 — Performance/Metabolismo (OTIMIZAÇÃO)\nCamada 3 — Hormonal (AJUSTE FINO)\nCamada 4 — Avançada (ATIVA)",
    programas: {
      "Sono": "",
      "Nutrição": "",
      "Exercício": "",
      "Suplementação": "",
      "Manipulados": "",
      "Soroterapia": "",
      "Metabolismo / GLP-1": "",
      "Hormonal": blocked.some((b) => b.module === "Hormonal") ? "BLOQUEADO — ver Engine State" : "",
      "Peptídeos": blocked.some((b) => b.module === "Peptídeos") ? "BLOQUEADO — ver Engine State" : "",
    },
    kpis:
      "30 dias:\n- \n\n60 dias:\n- \n\n90 dias:\n- ",
  };

  return {
    decision: { phase, blocked, alerts },
    report,
  };
}
