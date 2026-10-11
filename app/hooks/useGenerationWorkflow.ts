import { useRef, useState } from "react";
import { processStream } from "../utils/stream";
import { condenseInputs } from "../lib/condense";
import { getPinHeaders } from "../lib/api-client";
import { logGeneration } from "../lib/audit";
import { logger } from "../lib/logger";
import { isValidSex } from "../lib/extraction";
import { checkClinicalRules } from "../lib/clinicalRules";
import type { ClinicalData, ClinicalOutputs, EngineStatus, ToastState } from "../types/clinical";

interface GenerationWorkflowOptions {
  inputs: ClinicalData;
  outputs: ClinicalOutputs;
  setOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>;
  setOriginalOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>;
  setToast: (toast: ToastState) => void;
  currentPatientId: string | null;
  patientName: string;
  patientSex: string;
  engineStatus: EngineStatus;
  onEngineUpdate: () => void;
}

/** Extracts the server's explicit block reason instead of surfacing raw JSON in a toast. */
async function readErrorMessage(response: Response, fallbackLabel: string): Promise<string> {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) return parsed.error;
  } catch {
    // not JSON — fall through to raw body
  }
  return `${fallbackLabel} ${response.status}: ${body || response.statusText}`;
}

export function useGenerationWorkflow({
  inputs,
  outputs,
  setOutputs,
  setOriginalOutputs,
  setToast,
  currentPatientId,
  patientName,
  patientSex,
  engineStatus,
  onEngineUpdate,
}: GenerationWorkflowOptions) {
  const [isRunningAnalise, setIsRunningAnalise] = useState(false);
  const [isRunningConduta, setIsRunningConduta] = useState(false);
  const [isRunningReceita, setIsRunningReceita] = useState(false);
  // Last version of each output before it was regenerated, for "Restaurar"
  const [previousOutputs, setPreviousOutputs] = useState<Partial<ClinicalOutputs>>({});
  // Live reasoning summary shown while the model thinks, before text arrives
  const [thinkingPreview, setThinkingPreview] = useState<Partial<Record<keyof ClinicalOutputs, string>>>({});

  function appendThinking(field: keyof ClinicalOutputs, chunk: string) {
    setThinkingPreview((p) => ({ ...p, [field]: (p[field] || "") + chunk }));
  }

  function clearThinking(field: keyof ClinicalOutputs) {
    setThinkingPreview((p) => (p[field] ? { ...p, [field]: "" } : p));
  }

  function stashPrevious(field: keyof ClinicalOutputs) {
    const current = outputs[field];
    if (current.trim()) {
      setPreviousOutputs((p) => ({ ...p, [field]: current }));
    }
  }

  function handleRestoreOutput(field: keyof ClinicalOutputs) {
    const previous = previousOutputs[field];
    if (!previous) return;
    const replaced = outputs[field];
    setPreviousOutputs((p) => ({ ...p, [field]: replaced }));
    setOutputs((prev) => ({ ...prev, [field]: previous }));
    setToast({ message: "Versão anterior restaurada", type: "success" });
  }

  const analiseAbortRef = useRef<AbortController | null>(null);
  const condutaAbortRef = useRef<AbortController | null>(null);
  const receitaAbortRef = useRef<AbortController | null>(null);

  // Validation functions
  function canRunAnalise(): boolean {
    return inputs.anamnese.trim().length > 0 && isValidSex(patientSex);
  }

  function canRunConduta(): boolean {
    return inputs.anamnese.trim().length > 0 && isValidSex(patientSex);
  }

  function canRunReceita(): boolean {
    return outputs.conduta.trim().length > 0 && checkClinicalRules(outputs.conduta, patientSex).length === 0;
  }

  // --- ANALISE ---
  async function handleRunAnalise() {
    if (!inputs.anamnese.trim()) {
      setToast({ message: "Preencha pelo menos a Anamnese para gerar a Análise", type: "error" });
      return;
    }
    if (!isValidSex(patientSex)) {
      setToast({
        message: "Geração bloqueada: selecione o Sexo do paciente no painel lateral (Paciente → Sexo). Isso evita recomendações hormonais incorretas para o sexo do paciente.",
        type: "error",
      });
      return;
    }

    analiseAbortRef.current?.abort();
    analiseAbortRef.current = new AbortController();

    setIsRunningAnalise(true);
    stashPrevious("analise");
    setOutputs((prev) => ({ ...prev, analise: "" }));
    clearThinking("analise");

    try {
      const phaseContext = engineStatus ? { phase: engineStatus.phase, waiting: engineStatus.waiting } : undefined;

      // Invisible pre-step: huge pasted exams are distilled into structured
      // summaries before generation (falls back to raw text on failure).
      const patient = await condenseInputs(inputs, analiseAbortRef.current.signal);

      const response = await fetch("/api/generate-analise", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patient, patientSex, phaseContext }),
        signal: analiseAbortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Análise"));
      }

      await processStream(
        response,
        (chunk) => {
          clearThinking("analise");
          setOutputs((prev) => ({ ...prev, analise: prev.analise + chunk }));
        },
        analiseAbortRef.current.signal,
        (chunk) => appendThinking("analise", chunk)
      );

      onEngineUpdate();

      if (!analiseAbortRef.current.signal.aborted) {
        setToast({ message: "Análise Clínica Concluída!", type: "success" });
        setOutputs((current) => {
          setOriginalOutputs((prev) => ({ ...prev, analise: current.analise }));
          logGeneration({
            patientId: currentPatientId,
            patientName,
            source: "analise",
            model: "claude-sonnet",
            inputContext: inputs.anamnese.slice(0, 200),
            output: current.analise,
          });
          return current;
        });
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setToast({ message: "Análise interrompida", type: "info" });
      } else {
        logger.error("Generation failed", { error: err.message });
        setToast({ message: "Erro: " + err.message, type: "error" });
      }
    } finally {
      setIsRunningAnalise(false);
      clearThinking("analise");
      analiseAbortRef.current = null;
    }
  }

  function handleStopAnalise() {
    analiseAbortRef.current?.abort();
  }

  // --- CONDUTA ---
  async function handleRunConduta() {
    if (!inputs.anamnese.trim()) {
      setToast({ message: "Preencha pelo menos a Anamnese para gerar a Conduta", type: "error" });
      return;
    }
    if (!isValidSex(patientSex)) {
      setToast({
        message: "Geração bloqueada: selecione o Sexo do paciente no painel lateral (Paciente → Sexo). Isso evita recomendações hormonais incorretas para o sexo do paciente.",
        type: "error",
      });
      return;
    }

    condutaAbortRef.current?.abort();
    condutaAbortRef.current = new AbortController();

    setIsRunningConduta(true);
    stashPrevious("conduta");
    setOutputs((prev) => ({ ...prev, conduta: "" }));
    clearThinking("conduta");

    try {
      const phaseContext = engineStatus ? { phase: engineStatus.phase, waiting: engineStatus.waiting } : undefined;

      // Invisible pre-step: huge pasted exams are distilled into structured
      // summaries before generation (falls back to raw text on failure).
      const patient = await condenseInputs(inputs, condutaAbortRef.current.signal);

      const response = await fetch("/api/generate-conduta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patient, patientSex, phaseContext }),
        signal: condutaAbortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Conduta"));
      }

      await processStream(
        response,
        (chunk) => {
          clearThinking("conduta");
          setOutputs((prev) => ({ ...prev, conduta: prev.conduta + chunk }));
        },
        condutaAbortRef.current.signal,
        (chunk) => appendThinking("conduta", chunk)
      );

      onEngineUpdate();

      if (!condutaAbortRef.current.signal.aborted) {
        setToast({ message: "Conduta Terapêutica Concluída!", type: "success" });
        setOutputs((current) => {
          setOriginalOutputs((prev) => ({ ...prev, conduta: current.conduta }));
          logGeneration({
            patientId: currentPatientId,
            patientName,
            source: "conduta",
            model: "claude-sonnet",
            inputContext: inputs.anamnese.slice(0, 200),
            output: current.conduta,
          });
          return current;
        });
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setToast({ message: "Conduta interrompida", type: "info" });
      } else {
        logger.error("Generation failed", { error: err.message });
        setToast({ message: "Erro: " + err.message, type: "error" });
      }
    } finally {
      setIsRunningConduta(false);
      clearThinking("conduta");
      condutaAbortRef.current = null;
    }
  }

  function handleStopConduta() {
    condutaAbortRef.current?.abort();
  }

  // --- RECEITA ---
  async function handleRunReceita() {
    if (!outputs.conduta.trim()) {
      setToast({ message: "Gere a Conduta primeiro para criar a Receita", type: "error" });
      return;
    }
    const condutaViolations = checkClinicalRules(outputs.conduta, patientSex);
    if (condutaViolations.length > 0) {
      setToast({
        message: `Geração bloqueada: a Conduta contém o termo proibido "${condutaViolations[0].matchedTerm}" (regra ${condutaViolations[0].rule.id}). Corrija a Conduta antes de gerar a Receita.`,
        type: "error",
      });
      return;
    }

    receitaAbortRef.current?.abort();
    receitaAbortRef.current = new AbortController();

    setIsRunningReceita(true);
    stashPrevious("receita");
    setOutputs((prev) => ({ ...prev, receita: "" }));
    clearThinking("receita");

    try {
      const response = await fetch("/api/generate-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({
          conduta: outputs.conduta,
          patientName: patientName || "Paciente",
        }),
        signal: receitaAbortRef.current.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Receita ${response.status}: ${errorBody || response.statusText}`);
      }

      await processStream(
        response,
        (chunk) => {
          clearThinking("receita");
          setOutputs((prev) => ({ ...prev, receita: prev.receita + chunk }));
        },
        receitaAbortRef.current.signal,
        (chunk) => appendThinking("receita", chunk)
      );

      if (!receitaAbortRef.current.signal.aborted) {
        setToast({ message: "Receita Concluída!", type: "success" });
        setOutputs((current) => {
          setOriginalOutputs((prev) => ({ ...prev, receita: current.receita }));
          logGeneration({
            patientId: currentPatientId,
            patientName,
            source: "receita",
            model: "claude-sonnet",
            inputContext: outputs.conduta.slice(0, 200),
            output: current.receita,
          });
          return current;
        });
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setToast({ message: "Receita interrompida", type: "info" });
      } else {
        logger.error("Generation failed", { error: err.message });
        setToast({ message: "Erro: " + err.message, type: "error" });
      }
    } finally {
      setIsRunningReceita(false);
      clearThinking("receita");
      receitaAbortRef.current = null;
    }
  }

  function handleStopReceita() {
    receitaAbortRef.current?.abort();
  }

  return {
    // Analise
    isRunningAnalise,
    canRunAnalise,
    handleRunAnalise,
    handleStopAnalise,
    // Conduta
    isRunningConduta,
    canRunConduta,
    handleRunConduta,
    handleStopConduta,
    // Receita
    isRunningReceita,
    canRunReceita,
    handleRunReceita,
    handleStopReceita,
    // Restore
    previousOutputs,
    handleRestoreOutput,
    // Live reasoning preview while the model thinks
    thinkingPreview,
  };
}
