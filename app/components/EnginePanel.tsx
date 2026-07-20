"use client";

import type { EngineStatus, Settings } from "../types/clinical";
import { SectionLabel } from "./ui/SectionLabel";

type EnginePanelProps = {
  engineStatus: EngineStatus;
  settings: Settings;
};

const PHASE_BADGE = {
  A: "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200",
  B: "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200",
  C: "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200",
} as const;

const PRIORITY_UI = {
  amber: {
    card: "bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50",
    title: "text-amber-800 dark:text-amber-300",
    body: "text-amber-700 dark:text-amber-400",
  },
  blue: {
    card: "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50",
    title: "text-blue-800 dark:text-blue-300",
    body: "text-blue-700 dark:text-blue-400",
  },
  emerald: {
    card: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50",
    title: "text-emerald-800 dark:text-emerald-300",
    body: "text-emerald-700 dark:text-emerald-400",
  },
} as const;

function MetricChip({ label, value, alert }: { label: string; value: string; alert: boolean }) {
  return (
    <div
      className={`rounded-lg px-2 py-1.5 text-2xs compact:px-1.5 compact:py-1 ${
        alert
          ? "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
          : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
      }`}
    >
      <span className="font-semibold">{label}:</span> {value}
    </div>
  );
}

export function EnginePanel({ engineStatus, settings }: EnginePanelProps) {
  return (
    <>
      <SectionLabel>Inteligência Clínica</SectionLabel>
      {engineStatus ? (
        <div className="mt-3 space-y-4 compact:mt-2 compact:space-y-2">
          {/* Phase + Priority Badge */}
          <div
            className={`rounded-xl border p-4 compact:p-2.5 ${
              PRIORITY_UI[engineStatus.priorityColor as keyof typeof PRIORITY_UI]?.card ??
              PRIORITY_UI.emerald.card
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded font-bold text-2xs ${
                  PHASE_BADGE[engineStatus.phase as keyof typeof PHASE_BADGE] ?? PHASE_BADGE.C
                }`}
              >
                FASE {engineStatus.phase}
              </span>
              <span
                className={`font-semibold text-sm compact:text-xs ${
                  PRIORITY_UI[engineStatus.priorityColor as keyof typeof PRIORITY_UI]?.title ??
                  PRIORITY_UI.emerald.title
                }`}
              >
                {engineStatus.priority}
              </span>
            </div>
            <p
              className={`text-2xs ${
                PRIORITY_UI[engineStatus.priorityColor as keyof typeof PRIORITY_UI]?.body ??
                PRIORITY_UI.emerald.body
              }`}
            >
              {engineStatus.reason}
            </p>
          </div>

          {/* Parsed Metrics */}
          {engineStatus.metrics && Object.values(engineStatus.metrics).some((v) => v !== undefined) && (
            <div>
              <span className="uppercase text-slate-400 dark:text-slate-500 font-semibold tracking-wide text-2xs">
                Métricas detectadas
              </span>
              <div className="grid grid-cols-2 mt-2 gap-2 compact:mt-1 compact:gap-1">
                {engineStatus.metrics.hrv !== undefined && (
                  <MetricChip
                    label="HRV"
                    value={`${engineStatus.metrics.hrv}ms`}
                    alert={engineStatus.metrics.hrv < settings.thresholds.hrv}
                  />
                )}
                {engineStatus.metrics.rhr !== undefined && (
                  <MetricChip
                    label="RHR"
                    value={`${engineStatus.metrics.rhr}bpm`}
                    alert={engineStatus.metrics.rhr > settings.thresholds.rhr}
                  />
                )}
                {engineStatus.metrics.homaIr !== undefined && (
                  <MetricChip
                    label="HOMA-IR"
                    value={`${engineStatus.metrics.homaIr}`}
                    alert={engineStatus.metrics.homaIr > settings.thresholds.homaIr}
                  />
                )}
                {engineStatus.metrics.sleepHours !== undefined && (
                  <MetricChip
                    label="Sono"
                    value={`${engineStatus.metrics.sleepHours}h`}
                    alert={engineStatus.metrics.sleepHours < settings.thresholds.sleep}
                  />
                )}
              </div>
            </div>
          )}

          {/* Therapeutic Focus */}
          <div className="compact:hidden">
            <span className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
              Foco terapêutico
            </span>
            <ul className="mt-2 space-y-1.5">
              {engineStatus.focus.map((f, i) => (
                <li key={i} className="text-2xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <span className="text-slate-300 dark:text-slate-600 mt-0.5">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Module Status */}
          <div>
            <span className="uppercase text-slate-400 dark:text-slate-500 font-semibold tracking-wide text-2xs">
              Módulos
            </span>
            <div className="flex flex-wrap mt-2 gap-1.5 compact:mt-1 compact:gap-1">
              {engineStatus.enabled.map((m, i) => (
                <span
                  key={i}
                  className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-medium rounded-full px-2 py-1 text-2xs compact:px-1.5 compact:py-0.5"
                >
                  {m}
                </span>
              ))}
              {engineStatus.waiting.map((w, i) => (
                <span
                  key={i}
                  className="bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-medium rounded-full px-2 py-1 text-2xs compact:px-1.5 compact:py-0.5"
                  title={w.criteria}
                >
                  {w.module}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-2xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
          Execute a análise para ver a inteligência clínica
        </div>
      )}
    </>
  );
}
