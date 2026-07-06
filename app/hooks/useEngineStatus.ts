import { useCallback } from "react";
import { parseMetricsFromInputs } from "../lib/extraction";
import type { ClinicalData, EngineStatus, Settings } from "../types/clinical";

export function useEngineStatus(
  inputs: ClinicalData,
  settings: Settings,
  setEngineStatus: (status: EngineStatus) => void
) {
  const updateEngineStatus = useCallback(() => {
    const metrics = parseMetricsFromInputs(inputs);
    const allModules = ["Sono", "Nutrição", "Exercício", "Suplementação", "Manipulados", "Soroterapia", "GLP-1", "Hormonal", "Peptídeos"];
    const t = settings.thresholds;

    // Clinical thresholds from settings
    const hrvLow = metrics.hrv !== undefined && metrics.hrv < t.hrv;
    const rhrHigh = metrics.rhr !== undefined && metrics.rhr > t.rhr;
    const homaHigh = metrics.homaIr !== undefined && metrics.homaIr > t.homaIr;
    const sleepLow = metrics.sleepHours !== undefined && metrics.sleepHours < t.sleep;

    // Determine phase based on actual metrics
    const autonomicStress = hrvLow || rhrHigh;
    const metabolicIssue = homaHigh;
    const recoveryIssue = sleepLow;

    // Phase A: Autonomic instability - need recovery first
    if (autonomicStress) {
      const reasons: string[] = [];
      if (hrvLow) reasons.push(`HRV ${metrics.hrv}ms (< ${t.hrv}ms)`);
      if (rhrHigh) reasons.push(`RHR ${metrics.rhr}bpm (> ${t.rhr}bpm)`);

      setEngineStatus({
        phase: "A",
        priority: "Recuperação Autonômica",
        priorityColor: "amber",
        reason: reasons.join(" • "),
        focus: [
          "Estabilizar sistema nervoso autônomo",
          "Otimizar qualidade do sono",
          "Reduzir carga simpática"
        ],
        enabled: ["Sono", "Nutrição", "Exercício", "Suplementação", "Manipulados", "Soroterapia"],
        waiting: [
          { module: "Hormonal", criteria: `HRV > ${t.hrv}ms estável` },
          { module: "Peptídeos", criteria: `HRV > ${t.hrv}ms + sono > ${t.sleep + 1}h` }
        ],
        metrics
      });
      return;
    }

    // Phase B: Conservative - metabolic or recovery issues but stable autonomics
    if (metabolicIssue || recoveryIssue) {
      const reasons: string[] = [];
      if (homaHigh) reasons.push(`HOMA-IR ${metrics.homaIr} (> ${t.homaIr})`);
      if (sleepLow) reasons.push(`Sono ${metrics.sleepHours}h (< ${t.sleep}h)`);

      setEngineStatus({
        phase: "B",
        priority: "Otimização Conservadora",
        priorityColor: "blue",
        reason: reasons.join(" • ") || "Fase conservadora padrão",
        focus: [
          "Melhorar resistência insulínica",
          "Otimizar recuperação e sono",
          "Construir base metabólica"
        ],
        enabled: ["Sono", "Nutrição", "Exercício", "Suplementação", "Manipulados", "Soroterapia", "GLP-1"],
        waiting: [
          { module: "Peptídeos", criteria: `HOMA-IR < ${t.homaIr} + sono > ${t.sleep + 1}h` }
        ],
        metrics
      });
      return;
    }

    // Phase C: Optimization - all systems stable
    const hasAnyMetrics = Object.values(metrics).some(v => v !== undefined);
    setEngineStatus({
      phase: "C",
      priority: "Otimização Avançada",
      priorityColor: "emerald",
      reason: hasAnyMetrics
        ? `Métricas estáveis${metrics.hrv ? ` • HRV ${metrics.hrv}ms` : ""}${metrics.rhr ? ` • RHR ${metrics.rhr}bpm` : ""}`
        : "Aguardando dados para análise completa",
      focus: [
        "Maximizar composição corporal",
        "Otimizar eixos hormonais",
        "Potencializar performance"
      ],
      enabled: allModules,
      waiting: [],
      metrics
    });
  }, [inputs, settings.thresholds, setEngineStatus]);

  return { updateEngineStatus };
}
