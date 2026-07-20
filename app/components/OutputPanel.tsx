import { Undo2, Maximize2 } from "lucide-react";
import { DataBox } from "./DataBox";

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
  canRestore?: boolean;
  onRestore?: () => void;
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
  canRestore,
  onRestore,
}: OutputPanelProps) {
  const colors = colorMap[color];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 compact:mb-2">
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
          <span className={`text-2xs font-semibold uppercase ${colors.label} tracking-wider`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
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
        minHeight={minHeight}
        titleColor={color !== "emerald" ? colors.label : undefined}
      />
    </div>
  );
}
