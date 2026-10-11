import { useRef, useState } from "react";
import { getPinHeaders } from "../lib/api-client";
import { logger } from "../lib/logger";
import { splitCronograma, mergeCronograma } from "../lib/cronogramaSync";
import type { ClinicalOutputs, ToastState } from "../types/clinical";

/**
 * Doctor-triggered regeneration of the receita's CRONOGRAMA DIÁRIO section
 * from its current item list. Deliberately manual (a button), not an
 * auto-sync on every edit — the doctor decides when the item list has
 * settled enough to be worth re-scheduling.
 */
export function useCronogramaSync(
  outputs: ClinicalOutputs,
  currentPatientId: string | null,
  setOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>,
  setToast: (toast: ToastState) => void
) {
  const [isSyncingCronograma, setIsSyncingCronograma] = useState(false);
  // Guards against writing a stale response into a patient the doctor
  // switched to while the request was still in flight.
  const patientIdRef = useRef(currentPatientId);
  patientIdRef.current = currentPatientId;

  const canSyncCronograma = splitCronograma(outputs.receita) !== null;

  async function handleSyncCronograma() {
    const split = splitCronograma(outputs.receita);
    if (!split) {
      setToast({ message: "Nenhuma seção Cronograma Diário encontrada na receita.", type: "error" });
      return;
    }

    setIsSyncingCronograma(true);
    const requestPatientId = patientIdRef.current;

    try {
      const response = await fetch("/api/sync-cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ itemsText: split.itemsText, currentCronograma: split.heading }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Cronograma ${response.status}: ${body || response.statusText}`);
      }

      const data = await response.json();
      if (!data.text || typeof data.text !== "string" || !data.text.trim()) {
        throw new Error("Resposta vazia da IA");
      }

      setOutputs((prev) => {
        if (patientIdRef.current !== requestPatientId) return prev;
        const current = splitCronograma(prev.receita);
        if (!current) return prev;
        return { ...prev, receita: mergeCronograma(current.itemsText, data.text) };
      });
      setToast({ message: "Cronograma Diário atualizado!", type: "success" });
    } catch (err: any) {
      logger.error("Cronograma sync failed", { error: err.message });
      setToast({ message: "Erro ao atualizar Cronograma: " + err.message, type: "error" });
    } finally {
      setIsSyncingCronograma(false);
    }
  }

  return { canSyncCronograma, isSyncingCronograma, handleSyncCronograma };
}
