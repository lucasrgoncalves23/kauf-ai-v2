"use client";

import { useState } from "react";
import { Clock, ChevronDown, Download } from "lucide-react";
import type { Consulta } from "../types/clinical";

type ConsultaHistoryProps = {
  consultas: Consulta[];
  onLoadConsulta: (consulta: Consulta) => void;
};

const PHASE_BADGE = {
  A: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  B: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  C: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
} as const;

export function ConsultaHistory({ consultas, onLoadConsulta }: ConsultaHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (consultas.length === 0) {
    return (
      <div className="mt-4 compact:mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            Prontuário
          </span>
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 italic px-2">
          Nenhuma consulta salva ainda.
        </div>
      </div>
    );
  }

  // Group consultas by month/year
  const grouped: Record<string, Consulta[]> = {};
  for (const c of consultas) {
    const date = new Date(c.timestamp);
    const key = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  return (
    <div className="mt-4 compact:mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
          Prontuário
        </span>
        <span className="text-2xs text-slate-400 dark:text-slate-500 ml-auto">
          {consultas.length} consulta{consultas.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {Object.entries(grouped).map(([monthYear, monthConsultas]) => (
          <div key={monthYear}>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 px-1">
              {monthYear}
            </div>
            <div className="space-y-1">
              {monthConsultas.map((consulta) => {
                const date = new Date(consulta.timestamp);
                const isExpanded = expandedId === consulta.id;
                const hasAnalise = !!consulta.outputs.analise;
                const hasConduta = !!consulta.outputs.conduta;
                const hasReceita = !!consulta.outputs.receita;
                const inputKeys = Object.entries(consulta.inputs)
                  .filter(([, v]) => v.trim() !== "")
                  .map(([k]) => k);

                return (
                  <div
                    key={consulta.id}
                    className="rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-white/60 dark:bg-slate-800/60 overflow-hidden transition-all"
                  >
                    {/* Consulta header - clickable */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : consulta.id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-brand-400 dark:bg-brand-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </span>
                          <span className="text-2xs text-slate-400 dark:text-slate-500">
                            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasAnalise && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Análise" />}
                          {hasConduta && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Conduta" />}
                          {hasReceita && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Receita" />}
                          <ChevronDown
                            className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>
                      {/* Phase badge */}
                      {consulta.engineStatus && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`text-2xs font-bold px-1.5 py-0.5 rounded ${
                              PHASE_BADGE[consulta.engineStatus.phase as keyof typeof PHASE_BADGE] ?? PHASE_BADGE.C
                            }`}
                          >
                            FASE {consulta.engineStatus.phase}
                          </span>
                          <span className="text-2xs text-slate-400 dark:text-slate-500 truncate">
                            {consulta.engineStatus.priority}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-700/40 pt-2 space-y-2">
                        {inputKeys.length > 0 && (
                          <div>
                            <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold mb-1">
                              Dados
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {inputKeys.map((key) => (
                                <span
                                  key={key}
                                  className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize"
                                >
                                  {key}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {hasAnalise && (
                          <div>
                            <div className="text-2xs uppercase text-emerald-500 dark:text-emerald-400 font-semibold mb-0.5">
                              Análise
                            </div>
                            <div className="text-2xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {consulta.outputs.analise.slice(0, 150)}...
                            </div>
                          </div>
                        )}
                        {hasConduta && (
                          <div>
                            <div className="text-2xs uppercase text-indigo-500 dark:text-indigo-400 font-semibold mb-0.5">
                              Conduta
                            </div>
                            <div className="text-2xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {consulta.outputs.conduta.slice(0, 150)}...
                            </div>
                          </div>
                        )}
                        {hasReceita && (
                          <div>
                            <div className="text-2xs uppercase text-rose-500 dark:text-rose-400 font-semibold mb-0.5">
                              Receita
                            </div>
                            <div className="text-2xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {consulta.outputs.receita.slice(0, 150)}...
                            </div>
                          </div>
                        )}

                        {consulta.notes && (
                          <div>
                            <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold mb-0.5">
                              Notas
                            </div>
                            <div className="text-2xs text-slate-500 dark:text-slate-400">{consulta.notes}</div>
                          </div>
                        )}

                        {/* Load button */}
                        <button
                          onClick={() => onLoadConsulta(consulta)}
                          className="w-full mt-1 text-2xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          Carregar consulta
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
