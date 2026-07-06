"use client";

import type { ClinicalData } from "../types/clinical";
import { validateInput } from "../lib/extraction";
import { SectionLabel } from "./ui/SectionLabel";

type DataSourcesStatusProps = {
  inputs: ClinicalData;
  compact?: boolean;
};

export function DataSourcesStatus({ inputs, compact = false }: DataSourcesStatusProps) {
  return (
    <div className={`mt-auto border-t border-slate-100 dark:border-slate-700 ${compact ? "pt-4" : "pt-8"}`}>
      <SectionLabel>Data Sources</SectionLabel>
      <div className="space-y-2">
        {Object.entries(inputs).map(([k, v]) => {
          const validation = validateInput(k, v);
          const statusConfig = {
            ready: { label: "Ready", color: "text-emerald-600", dot: "bg-emerald-500" },
            incomplete: { label: "Incomplete", color: "text-amber-600", dot: "bg-amber-500" },
            empty: { label: "Empty", color: "text-slate-300 dark:text-slate-600", dot: "bg-slate-200 dark:bg-slate-600" },
          }[validation.status];

          return (
            <div key={k} className="group">
              <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="capitalize text-slate-500 dark:text-slate-400 font-medium">{k}</span>
                <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                  <span className="text-[10px] font-bold">{statusConfig.label}</span>
                  <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                </div>
              </div>
              {validation.status === "incomplete" && validation.missing.length > 0 && (
                <div className="px-2 pb-1 text-[9px] text-amber-600 opacity-80">
                  Falta: {validation.missing.join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
