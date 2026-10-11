"use client";

import { useMemo } from "react";
import { CalendarClock, FlaskConical, AlertTriangle, ChevronRight } from "lucide-react";
import type { ClinicalData, Consulta, EngineStatus } from "../types/clinical";
import { computeFollowUp, formatDateBR, type SuggestedLab } from "../lib/followUp";
import { SectionLabel } from "./ui/SectionLabel";

type SmartFollowUpProps = {
  consultas: Consulta[];
  currentInputs: ClinicalData;
  engineStatus: EngineStatus;
};

const PRIORITY_STYLES: Record<SuggestedLab["priority"], { dot: string; text: string }> = {
  high: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  medium: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  low: { dot: "bg-slate-300 dark:bg-slate-600", text: "text-slate-500 dark:text-slate-400" },
};

export function SmartFollowUp({ consultas, currentInputs, engineStatus }: SmartFollowUpProps) {
  const rec = useMemo(
    () => computeFollowUp(consultas, currentInputs, engineStatus),
    [consultas, currentInputs, engineStatus]
  );

  const isOverdue = rec.nextDate && new Date(rec.nextDate) < new Date();
  const topLabs = rec.suggestedLabs.slice(0, 6);
  const hasData = rec.lastConsultaDate || rec.suggestedLabs.length > 0;

  if (!hasData) return null;

  return (
    <div className="mt-4 compact:mt-2">
      <SectionLabel>Próximo Retorno</SectionLabel>
      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-4 compact:p-3 space-y-3">

        {/* Next visit */}
        <div className="flex items-start gap-3">
          <CalendarClock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isOverdue ? "text-red-500" : "text-brand-600 dark:text-brand-400"}`} />
          <div className="min-w-0">
            {rec.nextDate ? (
              <>
                <p className={`text-sm font-semibold ${isOverdue ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                  {formatDateBR(rec.nextDate)}
                  {isOverdue && <span className="ml-1.5 text-[10px] font-bold uppercase">Atrasado</span>}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {rec.interval.label} — {rec.interval.reason}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Salve uma consulta para calcular o retorno
              </p>
            )}
          </div>
        </div>

        {/* Suggested labs */}
        {topLabs.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Exames Sugeridos
              </span>
            </div>
            <div className="space-y-1">
              {topLabs.map((lab, i) => {
                const style = PRIORITY_STYLES[lab.priority];
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{lab.marker}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                    <span className={`text-[10px] ${style.text} truncate`}>{lab.reason}</span>
                  </div>
                );
              })}
            </div>
            {rec.suggestedLabs.length > topLabs.length && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                +{rec.suggestedLabs.length - topLabs.length} outro(s)
              </p>
            )}
          </div>
        )}

        {/* Overdue warning */}
        {isOverdue && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-[10px] text-red-600 dark:text-red-400">
              Última consulta em {formatDateBR(rec.lastConsultaDate!)} — retorno recomendado já passou
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
