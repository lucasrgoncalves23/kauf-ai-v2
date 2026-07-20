"use client";

import type { ClinicalData } from "../types/clinical";
import { validateInput } from "../lib/extraction";
import { SectionLabel } from "./ui/SectionLabel";

type DataSourcesStatusProps = {
  inputs: ClinicalData;
};

export function DataSourcesStatus({ inputs }: DataSourcesStatusProps) {
  return (
    <div className="mt-auto border-t border-slate-100 dark:border-slate-700 pt-8 compact:pt-4">
      <SectionLabel>Fontes de Dados</SectionLabel>
      <div className="space-y-2">
        {Object.entries(inputs).map(([k, v]) => {
          const validation = validateInput(k, v);
          const statusConfig = {
            ready: { label: "Completo", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            incomplete: { label: "Parcial", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
            empty: { label: "Vazio", color: "text-slate-300 dark:text-slate-600", dot: "bg-slate-200 dark:bg-slate-600" },
          }[validation.status];

          return (
            <div key={k} className="group">
              <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="capitalize text-slate-500 dark:text-slate-400 font-medium">{k}</span>
                <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                  <span className="text-2xs font-semibold">{statusConfig.label}</span>
                  <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                </div>
              </div>
              {validation.status === "incomplete" && validation.missing.length > 0 && (
                <div className="px-2 pb-1 text-2xs text-amber-600 dark:text-amber-400 opacity-80">
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
