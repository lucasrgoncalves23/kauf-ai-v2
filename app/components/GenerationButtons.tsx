"use client";

type GenerationButtonsProps = {
  compact: boolean;
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

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function GenerationButtons({
  compact,
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
  const baseClass = `flex items-center gap-3 rounded-full font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all ${
    compact ? "px-5 py-2.5 text-xs" : "px-8 py-4 text-sm"
  }`;

  const stopClass = `${baseClass} bg-red-500 text-white shadow-red-200 hover:bg-red-600`;
  const disabledClass = `${baseClass} bg-slate-100 text-slate-400 cursor-not-allowed shadow-none`;

  return (
    <div className={`no-print flex justify-center gap-4 ${compact ? "py-2" : "py-4"}`}>
      {/* Análise Button */}
      {isRunningAnalise ? (
        <button onClick={onStopAnalise} className={stopClass}>
          <StopIcon />
          <span>Parar</span>
        </button>
      ) : (
        <button
          onClick={onRunAnalise}
          disabled={!canRunAnalise}
          className={
            !canRunAnalise
              ? disabledClass
              : `${baseClass} bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-200`
          }
        >
          <span>Gerar Análise</span>
        </button>
      )}

      {/* Conduta Button */}
      {isRunningConduta ? (
        <button onClick={onStopConduta} className={stopClass}>
          <StopIcon />
          <span>Parar</span>
        </button>
      ) : (
        <button
          onClick={onRunConduta}
          disabled={!canRunConduta}
          className={
            !canRunConduta
              ? disabledClass
              : `${baseClass} bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-200`
          }
        >
          <span>Gerar Conduta</span>
        </button>
      )}

      {/* Receita Button */}
      {isRunningReceita ? (
        <button onClick={onStopReceita} className={stopClass}>
          <StopIcon />
          <span>Parar</span>
        </button>
      ) : (
        <button
          onClick={onRunReceita}
          disabled={!canRunReceita}
          className={
            !canRunReceita
              ? disabledClass
              : `${baseClass} bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-rose-200`
          }
        >
          <span>Gerar Receita</span>
        </button>
      )}
    </div>
  );
}
