import { DataBox } from "./DataBox";

const colorMap = {
  emerald: {
    dot: "bg-emerald-500",
    label: "text-emerald-600",
    button: "hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
  },
  indigo: {
    dot: "bg-indigo-500",
    label: "text-indigo-600",
    button: "hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
  },
  rose: {
    dot: "bg-rose-500",
    label: "text-rose-600",
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
  compact: boolean;
  minHeight: string;
};

export function OutputPanel({
  label,
  color,
  dataBoxTitle,
  value,
  onChange,
  onBlur,
  onFullscreen,
  compact,
  minHeight,
}: OutputPanelProps) {
  const colors = colorMap[color];

  return (
    <div>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
          <span className={`text-[10px] font-bold uppercase ${colors.label} tracking-widest`}>{label}</span>
        </div>
        <button
          onClick={onFullscreen}
          className={`no-print p-1.5 rounded-lg text-slate-400 ${colors.button} transition-colors`}
          title="Editar em tela cheia"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
      <DataBox
        title={dataBoxTitle}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        isOutput
        minHeight={minHeight}
        titleColor={color !== "emerald" ? colors.label : undefined}
        compact={compact}
      />
    </div>
  );
}
