"use client";

import { Square } from "lucide-react";

type GenerationButtonsProps = {
  // Análise
  isRunningAnalise: boolean;
  /** Why it can't run yet ("Falta anamnese"), or null when it can */
  analiseBlocked: string | null;
  onRunAnalise: () => void;
  onStopAnalise: () => void;
  // Conduta
  isRunningConduta: boolean;
  /** Why it can't run yet ("Falta anamnese"), or null when it can */
  condutaBlocked: string | null;
  onRunConduta: () => void;
  onStopConduta: () => void;
  // Receita
  isRunningReceita: boolean;
  /** Why it can't run yet ("Falta anamnese"), or null when it can */
  receitaBlocked: string | null;
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
  blockedReason: string | null;
  onRun: () => void;
  onStop: () => void;
  activeClass: string;
};

function RunButton({ label, isRunning, blockedReason, onRun, onStop, activeClass }: RunButtonProps) {
  if (isRunning) {
    return (
      <div className="flex flex-col items-center">
        <button onClick={onStop} className={stopClass}>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Parar</span>
        </button>
      </div>
    );
  }
  const blocked = !!blockedReason;
  return (
    <div className="flex flex-col items-center gap-1.5 compact:gap-1">
      <button
        onClick={onRun}
        disabled={blocked}
        title={blockedReason ?? undefined}
        className={blocked ? disabledClass : `${baseClass} ${activeClass} text-white hover:-translate-y-0.5 hover:shadow-xl`}
      >
        <span>{label}</span>
      </button>
      {blocked && (
        <span className="max-w-[16rem] text-center text-2xs font-medium text-amber-600 dark:text-amber-400">
          {blockedReason}
        </span>
      )}
    </div>
  );
}

export function GenerationButtons({
  isRunningAnalise,
  analiseBlocked,
  onRunAnalise,
  onStopAnalise,
  isRunningConduta,
  condutaBlocked,
  onRunConduta,
  onStopConduta,
  isRunningReceita,
  receitaBlocked,
  onRunReceita,
  onStopReceita,
}: GenerationButtonsProps) {
  return (
    <div className="no-print flex justify-center items-start gap-4 py-4 compact:py-2">
      <RunButton
        label="Gerar Análise"
        isRunning={isRunningAnalise}
        blockedReason={analiseBlocked}
        onRun={onRunAnalise}
        onStop={onStopAnalise}
        activeClass="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25"
      />
      <RunButton
        label="Gerar Conduta"
        isRunning={isRunningConduta}
        blockedReason={condutaBlocked}
        onRun={onRunConduta}
        onStop={onStopConduta}
        activeClass="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25"
      />
      <RunButton
        label="Gerar Receita"
        isRunning={isRunningReceita}
        blockedReason={receitaBlocked}
        onRun={onRunReceita}
        onStop={onStopReceita}
        activeClass="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/25"
      />
    </div>
  );
}
