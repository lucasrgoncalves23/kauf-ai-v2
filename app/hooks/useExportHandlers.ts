import { useState } from "react";
import { logExport, logRuleViolation } from "../lib/audit";
import { checkClinicalRules, type RuleViolation } from "../lib/clinicalRules";
import type { ClinicalOutputs, ToastState } from "../types/clinical";
import type { GenerationSource } from "../lib/audit";

interface ExportHandlersOptions {
  outputs: ClinicalOutputs;
  currentPatientId: string | null;
  patientName: string;
  patientSex: string;
  setToast: (toast: ToastState) => void;
}

export function useExportHandlers({
  outputs,
  currentPatientId,
  patientName,
  patientSex,
  setToast,
}: ExportHandlersOptions) {
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [prescriptionContent, setPrescriptionContent] = useState<string | null>(null);

  // Blocks export if the relevant document(s) violate a deterministic clinical
  // rule. Logs every violation and shows an explicit toast naming the rule.
  function blockedByRuleViolation(sources: { field: GenerationSource; text: string }[]): boolean {
    const violations: (RuleViolation & { source: GenerationSource })[] = [];
    for (const { field, text } of sources) {
      for (const v of checkClinicalRules(text, patientSex)) {
        violations.push({ ...v, source: field });
      }
    }
    if (violations.length === 0) return false;

    for (const v of violations) {
      logRuleViolation({
        patientId: currentPatientId,
        patientName,
        source: v.source,
        ruleId: v.rule.id,
        matchedTerm: v.matchedTerm,
      });
    }
    const first = violations[0];
    setToast({
      message: `Exportação bloqueada: documento contém o termo proibido "${first.matchedTerm}" (regra ${first.rule.id}). Corrija antes de exportar.`,
      type: "error",
    });
    return true;
  }

  // Export clinical PDF (original)
  function handleExportClinical() {
    if (blockedByRuleViolation([
      { field: "analise", text: outputs.analise },
      { field: "conduta", text: outputs.conduta },
    ])) return;

    setShowExportDropdown(false);
    logExport({
      patientId: currentPatientId,
      patientName,
      format: "clinical",
      content: {
        analise: outputs.analise,
        conduta: outputs.conduta,
        receita: outputs.receita,
      },
    });
    window.print();
  }

  // Generate and export prescription PDF
  function handleExportPrescription() {
    if (blockedByRuleViolation([{ field: "receita", text: outputs.receita }])) return;

    setShowExportDropdown(false);

    if (!outputs.receita) {
      setToast({ message: "Gere a Receita primeiro", type: "error" });
      return;
    }

    logExport({
      patientId: currentPatientId,
      patientName,
      format: "prescription",
      content: {
        receita: outputs.receita,
      },
    });

    // Use existing receita content for printing
    setPrescriptionContent(outputs.receita);

    // Small delay to allow state update, then print
    setTimeout(() => {
      window.print();
      // Clear after printing
      setTimeout(() => setPrescriptionContent(null), 1000);
    }, 100);
  }

  return {
    showExportDropdown,
    setShowExportDropdown,
    prescriptionContent,
    handleExportClinical,
    handleExportPrescription,
  };
}
