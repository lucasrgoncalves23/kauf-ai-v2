import { Undo2, Maximize2, AlertTriangle, RefreshCw } from "lucide-react";
import { DataBox } from "./DataBox";
import { Spinner } from "./ui/Spinner";
import type { RuleViolation } from "../lib/clinicalRules";

const colorMap = {
  emerald: {
    dot: "bg-emerald-500",
    label: "text-emerald-600 dark:text-emerald-400",
    button: "hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
  },
  indigo: {
    dot: "bg-indigo-500",
    label: "text-indigo-600 dark:text-indigo-400",
    button: "hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
  },
  rose: {
    dot: "bg-rose-500",
    label: "text-rose-600 dark:text-rose-400",
    button: "hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30",
  },
} as const;

type OutputPanelProps = {
  label: string;
  color: keyof typeof colorMap;
  dataBoxTitle: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onFullscreen: () => void;
  minHeight: string;
  isRunning?: boolean;
  thinkingText?: string;
  canRestore?: boolean;
  onRestore?: () => void;
  violations?: RuleViolation[];
  canSyncCronograma?: boolean;
  isSyncingCronograma?: boolean;
  onSyncCronograma?: () => void;
};

export function OutputPanel({
  label,
  color,
  dataBoxTitle,
  value,
  onChange,
  onBlur,
  onFullscreen,
  minHeight,
  isRunning = false,
  thinkingText,
  canRestore,
  onRestore,
  violations,
  canSyncCronograma,
  isSyncingCronograma,
  onSyncCronograma,
}: OutputPanelProps) {
  const colors = colorMap[color];

  return (
    <div>
      {!!violations?.length && (
        <div className="no-print flex items-start gap-2 mb-3 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
            <p className="font-semibold">
              Documento viola {violations.length > 1 ? "regras clínicas" : "uma regra clínica"} — corrija antes de salvar ou exportar.
            </p>
            {violations.map((v, i) => (
              <p key={i}>
                Termo proibido "{v.matchedTerm}" (regra {v.rule.id}
                {v.rule.notes ? ` — ${v.rule.notes}` : ""})
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 compact:mb-2">
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
          <span className={`text-2xs font-semibold uppercase ${colors.label} tracking-wider`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canSyncCronograma && onSyncCronograma && (
            <button
              onClick={onSyncCronograma}
              disabled={isSyncingCronograma}
              className={`no-print flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-2xs font-medium text-slate-400 ${colors.button} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Regenerar Cronograma Diário a partir dos itens atuais"
            >
              {isSyncingCronograma ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isSyncingCronograma ? "Atualizando…" : "Regenerar Cronograma"}
            </button>
          )}
          {canRestore && onRestore && (
            <button
              onClick={onRestore}
              className={`no-print flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-2xs font-medium text-slate-400 ${colors.button} transition-colors`}
              title="Restaurar versão anterior"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Restaurar
            </button>
          )}
          <button
            onClick={onFullscreen}
            className={`no-print p-1.5 rounded-lg text-slate-400 ${colors.button} transition-colors`}
            title="Editar em tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <DataBox
        title={dataBoxTitle}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        isOutput
        isStreaming={isRunning}
        thinkingText={thinkingText}
        minHeight={minHeight}
        titleColor={color !== "emerald" ? colors.label : undefined}
      />
    </div>
  );
}
