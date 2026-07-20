"use client";

import { Square } from "lucide-react";

type GenerationButtonsProps = {
  // Análise
  isRunningAnalise: boolean;
  canRunAnalise: boolean;
  onRunAnalise: () => void;
  onStopAnalise: () => void;
  // Conduta
  isRunningConduta: boolean;
  canRunConduta: boolean;
  onRunConduta: () => void;
  onStopConduta: () => void;
  // Receita
  isRunningReceita: boolean;
  canRunReceita: boolean;
  onRunReceita: () => void;
  onStopReceita: () => void;
};

const baseClass =
  "flex items-center gap-2.5 rounded-full font-semibold transition-all px-8 py-4 text-sm compact:px-5 compact:py-2.5 compact:text-xs";

const stopClass = `${baseClass} bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600`;
const disabledClass = `${baseClass} bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed`;

type RunButtonProps = {
  label: string;
  isRunning: boolean;
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
  activeClass: string;
};

function RunButton({ label, isRunning, canRun, onRun, onStop, activeClass }: RunButtonProps) {
  if (isRunning) {
    return (
      <button onClick={onStop} className={stopClass}>
        <Square className="w-3.5 h-3.5 fill-current" />
        <span>Parar</span>
      </button>
    );
  }
  return (
    <button
      onClick={onRun}
      disabled={!canRun}
      className={!canRun ? disabledClass : `${baseClass} ${activeClass} text-white hover:-translate-y-0.5 hover:shadow-xl`}
    >
      <span>{label}</span>
    </button>
  );
}

export function GenerationButtons({
  isRunningAnalise,
  canRunAnalise,
  onRunAnalise,
  onStopAnalise,
  isRunningConduta,
  canRunConduta,
  onRunConduta,
  onStopConduta,
  isRunningReceita,
  canRunReceita,
  onRunReceita,
  onStopReceita,
}: GenerationButtonsProps) {
  return (
    <div className="no-print flex justify-center gap-4 py-4 compact:py-2">
      <RunButton
        label="Gerar Análise"
        isRunning={isRunningAnalise}
        canRun={canRunAnalise}
        onRun={onRunAnalise}
        onStop={onStopAnalise}
        activeClass="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25"
      />
      <RunButton
        label="Gerar Conduta"
        isRunning={isRunningConduta}
        canRun={canRunConduta}
        onRun={onRunConduta}
        onStop={onStopConduta}
        activeClass="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25"
      />
      <RunButton
        label="Gerar Receita"
        isRunning={isRunningReceita}
        canRun={canRunReceita}
        onRun={onRunReceita}
        onStop={onStopReceita}
        activeClass="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/25"
      />
    </div>
  );
}
