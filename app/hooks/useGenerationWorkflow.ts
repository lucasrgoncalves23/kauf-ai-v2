import { useRef, useState } from "react";
import { processStream } from "../utils/stream";
import { getCorrections } from "../lib/corrections";
import { getPinHeaders } from "../lib/api-client";
import { logGeneration } from "../lib/audit";
import { logger } from "../lib/logger";
import type { ClinicalData, ClinicalOutputs, EngineStatus, ToastState } from "../types/clinical";

interface GenerationWorkflowOptions {
  inputs: ClinicalData;
  outputs: ClinicalOutputs;
  setOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>;
  setOriginalOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>;
  setToast: (toast: ToastState) => void;
  currentPatientId: string | null;
  patientName: string;
  engineStatus: EngineStatus;
  onEngineUpdate: () => void;
}

export function useGenerationWorkflow({
  inputs,
  outputs,
  setOutputs,
  setOriginalOutputs,
  setToast,
  currentPatientId,
  patientName,
  engineStatus,
  onEngineUpdate,
}: GenerationWorkflowOptions) {
  const [isRunningAnalise, setIsRunningAnalise] = useState(false);
  const [isRunningConduta, setIsRunningConduta] = useState(false);
  const [isRunningReceita, setIsRunningReceita] = useState(false);

  const analiseAbortRef = useRef<AbortController | null>(null);
  const condutaAbortRef = useRef<AbortController | null>(null);
  const receitaAbortRef = useRef<AbortController | null>(null);

  // Validation functions
  function canRunAnalise(): boolean {
    return inputs.anamnese.trim().length > 0;
  }

  function canRunConduta(): boolean {
    return inputs.anamnese.trim().length > 0;
  }

  function canRunReceita(): boolean {
    return outputs.conduta.trim().length > 0;
  }

  // --- ANALISE ---
  async function handleRunAnalise() {
    if (!canRunAnalise()) {
      setToast({ message: "Preencha pelo menos a Anamnese para gerar a Análise", type: "error" });
      return;
    }

    analiseAbortRef.current?.abort();
    analiseAbortRef.current = new AbortController();

    setIsRunningAnalise(true);
    setOutputs((prev) => ({ ...prev, analise: "" }));

    try {
      const approvedCorrections = getCorrections("analise", true).slice(0, 3);

      const phaseContext = engineStatus ? { phase: engineStatus.phase, waiting: engineStatus.waiting } : undefined;

      const response = await fetch("/api/generate-analise", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patient: inputs, corrections: approvedCorrections, phaseContext }),
        signal: analiseAbortRef.current.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Análise ${response.status}: ${errorBody || response.statusText}`);
      }

      await processStream(
        response,
        (chunk) => setOutputs((prev) => ({ ...prev, analise: prev.analise + chunk })),
        analiseAbortRef.current.signal
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
      analiseAbortRef.current = null;
    }
  }

  function handleStopAnalise() {
    analiseAbortRef.current?.abort();
  }

  // --- CONDUTA ---
  async function handleRunConduta() {
    if (!canRunConduta()) {
      setToast({ message: "Preencha pelo menos a Anamnese para gerar a Conduta", type: "error" });
      return;
    }

    condutaAbortRef.current?.abort();
    condutaAbortRef.current = new AbortController();

    setIsRunningConduta(true);
    setOutputs((prev) => ({ ...prev, conduta: "" }));

    try {
      const approvedCorrections = getCorrections("conduta", true).slice(0, 3);

      const phaseContext = engineStatus ? { phase: engineStatus.phase, waiting: engineStatus.waiting } : undefined;

      const response = await fetch("/api/generate-conduta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patient: inputs, corrections: approvedCorrections, phaseContext }),
        signal: condutaAbortRef.current.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Conduta ${response.status}: ${errorBody || response.statusText}`);
      }

      await processStream(
        response,
        (chunk) => setOutputs((prev) => ({ ...prev, conduta: prev.conduta + chunk })),
        condutaAbortRef.current.signal
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
      condutaAbortRef.current = null;
    }
  }

  function handleStopConduta() {
    condutaAbortRef.current?.abort();
  }

  // --- RECEITA ---
  async function handleRunReceita() {
    if (!canRunReceita()) {
      setToast({ message: "Gere a Conduta primeiro para criar a Receita", type: "error" });
      return;
    }

    receitaAbortRef.current?.abort();
    receitaAbortRef.current = new AbortController();

    setIsRunningReceita(true);
    setOutputs((prev) => ({ ...prev, receita: "" }));

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
        (chunk) => setOutputs((prev) => ({ ...prev, receita: prev.receita + chunk })),
        receitaAbortRef.current.signal
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
      receitaAbortRef.current = null;
    }
  }

  function handleStopReceita() {
    receitaAbortRef.current?.abort();
  }

  // --- RUN ALL (Análise + Conduta in parallel) ---
  const [isRunningAll, setIsRunningAll] = useState(false);

  async function handleRunAll() {
    if (!canRunAnalise() || !canRunConduta()) {
      setToast({ message: "Preencha pelo menos a Anamnese para gerar", type: "error" });
      return;
    }

    setIsRunningAll(true);
    try {
      await Promise.all([handleRunAnalise(), handleRunConduta()]);
    } finally {
      setIsRunningAll(false);
    }
  }

  function handleStopAll() {
    analiseAbortRef.current?.abort();
    condutaAbortRef.current?.abort();
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
  };
}
