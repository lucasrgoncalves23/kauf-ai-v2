"use client";

import type { EngineStatus, Settings } from "../types/clinical";
import { SectionLabel } from "./ui/SectionLabel";

type EnginePanelProps = {
  engineStatus: EngineStatus;
  settings: Settings;
};

export function EnginePanel({ engineStatus, settings }: EnginePanelProps) {
  const compact = settings.ui.compactView;

  return (
    <>
      <SectionLabel>Inteligência Clinica</SectionLabel>
      {engineStatus ? (
        <div className={`${compact ? "mt-2 space-y-2" : "mt-3 space-y-4"}`}>
          {/* Phase + Priority Badge */}
          <div
            className={`rounded-xl border ${compact ? "p-2.5" : "p-4"} ${
              engineStatus.priorityColor === "amber"
                ? "bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50"
                : engineStatus.priorityColor === "blue"
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50"
                  : "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded font-bold ${compact ? "text-[9px]" : "text-[10px]"} ${
                  engineStatus.phase === "A"
                    ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                    : engineStatus.phase === "B"
                      ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                      : "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                FASE {engineStatus.phase}
              </span>
              <span
                className={`font-bold ${compact ? "text-xs" : "text-sm"} ${
                  engineStatus.priorityColor === "amber"
                    ? "text-amber-800 dark:text-amber-300"
                    : engineStatus.priorityColor === "blue"
                      ? "text-blue-800 dark:text-blue-300"
                      : "text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {engineStatus.priority}
              </span>
            </div>
            <p
              className={`${compact ? "text-[10px]" : "text-[11px]"} ${
                engineStatus.priorityColor === "amber"
                  ? "text-amber-700 dark:text-amber-400"
                  : engineStatus.priorityColor === "blue"
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {engineStatus.reason}
            </p>
          </div>

          {/* Parsed Metrics */}
          {engineStatus.metrics && Object.values(engineStatus.metrics).some((v) => v !== undefined) && (
            <div>
              <span
                className={`uppercase text-slate-400 dark:text-slate-500 font-bold tracking-wide ${
                  compact ? "text-[9px]" : "text-[10px]"
                }`}
              >
                Metricas Detectadas
              </span>
              <div className={`grid grid-cols-2 ${compact ? "mt-1 gap-1" : "mt-2 gap-2"}`}>
                {engineStatus.metrics.hrv !== undefined && (
                  <div
                    className={`rounded-lg ${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1.5 text-[11px]"} ${
                      engineStatus.metrics.hrv < settings.thresholds.hrv
                        ? "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <span className="font-medium">HRV:</span> {engineStatus.metrics.hrv}ms
                  </div>
                )}
                {engineStatus.metrics.rhr !== undefined && (
                  <div
                    className={`rounded-lg ${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1.5 text-[11px]"} ${
                      engineStatus.metrics.rhr > settings.thresholds.rhr
                        ? "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <span className="font-medium">RHR:</span> {engineStatus.metrics.rhr}bpm
                  </div>
                )}
                {engineStatus.metrics.homaIr !== undefined && (
                  <div
                    className={`rounded-lg ${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1.5 text-[11px]"} ${
                      engineStatus.metrics.homaIr > settings.thresholds.homaIr
                        ? "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <span className="font-medium">HOMA-IR:</span> {engineStatus.metrics.homaIr}
                  </div>
                )}
                {engineStatus.metrics.sleepHours !== undefined && (
                  <div
                    className={`rounded-lg ${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1.5 text-[11px]"} ${
                      engineStatus.metrics.sleepHours < settings.thresholds.sleep
                        ? "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <span className="font-medium">Sono:</span> {engineStatus.metrics.sleepHours}h
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Therapeutic Focus */}
          {!compact && (
            <div>
              <span className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-wide">
                Foco Terapeutico
              </span>
              <ul className="mt-2 space-y-1.5">
                {engineStatus.focus.map((f, i) => (
                  <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span className="text-slate-300 dark:text-slate-600 mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Module Status */}
          <div>
            <span
              className={`uppercase text-slate-400 dark:text-slate-500 font-bold tracking-wide ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              Modulos
            </span>
            <div className={`flex flex-wrap ${compact ? "mt-1 gap-1" : "mt-2 gap-1.5"}`}>
              {engineStatus.enabled.map((m, i) => (
                <span
                  key={i}
                  className={`bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-medium rounded-full ${
                    compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
                  }`}
                >
                  {m}
                </span>
              ))}
              {engineStatus.waiting.map((w, i) => (
                <span
                  key={i}
                  className={`bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-medium rounded-full ${
                    compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
                  }`}
                  title={w.criteria}
                >
                  {w.module}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic py-4 text-center">
          Execute a analise para ver a inteligencia clinica
        </div>
      )}
    </>
  );
}
