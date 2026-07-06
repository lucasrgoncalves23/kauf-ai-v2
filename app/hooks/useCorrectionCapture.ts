import { useState } from "react";
import {
  saveCorrection,
  getCorrections,
  isSignificantChange,
  type Correction,
  type CorrectionField,
} from "../lib/corrections";
import { logEdit } from "../lib/audit";
import type { ClinicalOutputs, PatientProfile, ToastState } from "../types/clinical";

export function useCorrectionCapture(
  outputs: ClinicalOutputs,
  patientProfile: PatientProfile,
  currentPatientId: string | null,
  setToast: (toast: ToastState) => void
) {
  const [originalOutputs, setOriginalOutputs] = useState<ClinicalOutputs>({ analise: "", conduta: "", receita: "" });
  const [showCorrectionsPanel, setShowCorrectionsPanel] = useState(false);
  const [correctionsList, setCorrectionsList] = useState<Correction[]>([]);

  function refreshCorrectionsList() {
    setCorrectionsList(getCorrections());
  }

  function handleOutputBlur(field: CorrectionField) {
    const original = originalOutputs[field];
    const current = outputs[field];

    // Only capture if there's an original (AI generated) and it was changed
    if (original && isSignificantChange(original, current)) {
      saveCorrection({
        field,
        original,
        corrected: current,
        patientContext: {
          name: patientProfile.name || undefined,
          age: patientProfile.age || undefined,
          sex: patientProfile.sex || undefined,
        },
        approved: false, // Doctor must explicitly approve
      });
      setCorrectionsList(getCorrections());
      setToast({ message: "Correção capturada automaticamente", type: "info" });

      // Log edit event for audit trail
      logEdit({
        patientId: currentPatientId,
        patientName: patientProfile.name,
        field,
        original,
        edited: current,
      });
    }
  }

  function handleSaveAsExample(field: CorrectionField) {
    const original = originalOutputs[field];
    const current = outputs[field];

    if (!original) {
      setToast({ message: "Gere um relatório primeiro para salvar correções", type: "error" });
      return;
    }

    if (original === current) {
      setToast({ message: "Nenhuma alteração para salvar", type: "info" });
      return;
    }

    saveCorrection({
      field,
      original,
      corrected: current,
      patientContext: {
        name: patientProfile.name || undefined,
        age: patientProfile.age || undefined,
        sex: patientProfile.sex || undefined,
      },
      approved: true, // Explicit save = pre-approved
    });
    setCorrectionsList(getCorrections());
    setToast({ message: "Correção salva como exemplo!", type: "success" });
  }

  return {
    originalOutputs,
    setOriginalOutputs,
    showCorrectionsPanel,
    setShowCorrectionsPanel,
    correctionsList,
    handleOutputBlur,
    handleSaveAsExample,
    refreshCorrectionsList,
  };
}
