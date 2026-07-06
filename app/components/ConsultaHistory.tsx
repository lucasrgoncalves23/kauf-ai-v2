"use client";

import { useState } from "react";
import type { Consulta } from "../types/clinical";

type ConsultaHistoryProps = {
  consultas: Consulta[];
  onLoadConsulta: (consulta: Consulta) => void;
  compact?: boolean;
};

export function ConsultaHistory({ consultas, onLoadConsulta, compact = false }: ConsultaHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (consultas.length === 0) {
    return (
      <div className={compact ? "mt-3" : "mt-4"}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
            Prontuario
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
    <div className={compact ? "mt-3" : "mt-4"}>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
          Prontuario
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
          {consultas.length} consulta{consultas.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {Object.entries(grouped).map(([monthYear, monthConsultas]) => (
          <div key={monthYear}>
            <div className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 px-1">
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
                          {/* Timeline dot */}
                          <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Output indicators */}
                          {hasAnalise && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Analise" />}
                          {hasConduta && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Conduta" />}
                          {hasReceita && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Receita" />}
                          <svg
                            className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {/* Phase badge */}
                      {consulta.engineStatus && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            consulta.engineStatus.phase === "A"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : consulta.engineStatus.phase === "B"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          }`}>
                            FASE {consulta.engineStatus.phase}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {consulta.engineStatus.priority}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-700/40 pt-2 space-y-2">
                        {/* Input sources */}
                        {inputKeys.length > 0 && (
                          <div>
                            <div className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Dados</div>
                            <div className="flex flex-wrap gap-1">
                              {inputKeys.map((key) => (
                                <span
                                  key={key}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize"
                                >
                                  {key}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Output previews */}
                        {hasAnalise && (
                          <div>
                            <div className="text-[9px] uppercase text-emerald-500 dark:text-emerald-400 font-bold mb-0.5">Analise</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {consulta.outputs.analise.slice(0, 150)}...
                            </div>
                          </div>
                        )}
                        {hasConduta && (
                          <div>
                            <div className="text-[9px] uppercase text-indigo-500 dark:text-indigo-400 font-bold mb-0.5">Conduta</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {consulta.outputs.conduta.slice(0, 150)}...
                            </div>
                          </div>
                        )}
                        {hasReceita && (
                          <div>
                            <div className="text-[9px] uppercase text-rose-500 dark:text-rose-400 font-bold mb-0.5">Receita</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {consulta.outputs.receita.slice(0, 150)}...
                            </div>
                          </div>
                        )}

                        {consulta.notes && (
                          <div>
                            <div className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold mb-0.5">Notas</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{consulta.notes}</div>
                          </div>
                        )}

                        {/* Load button */}
                        <button
                          onClick={() => onLoadConsulta(consulta)}
                          className="w-full mt-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          CARREGAR CONSULTA
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
