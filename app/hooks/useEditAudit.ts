import { useState } from "react";
import { isSignificantChange, logEdit } from "../lib/audit";
import type { ClinicalOutputs } from "../types/clinical";

export function useEditAudit(
  outputs: ClinicalOutputs,
  patientName: string,
  currentPatientId: string | null
) {
  const [originalOutputs, setOriginalOutputs] = useState<ClinicalOutputs>({ analise: "", conduta: "", receita: "" });

  function handleOutputBlur(field: keyof ClinicalOutputs) {
    const original = originalOutputs[field];
    const current = outputs[field];
    if (!isSignificantChange(original, current)) return;

    logEdit({
      patientId: currentPatientId,
      patientName,
      field,
      original,
      edited: current,
    });
  }

  return { setOriginalOutputs, handleOutputBlur };
}
