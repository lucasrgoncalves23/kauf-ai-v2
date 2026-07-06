"use client";

import { useState } from "react";
import type { Correction } from "../lib/corrections";
import { getDiffSummary } from "../lib/corrections";

type CorrectionsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  corrections: Correction[];
  onApprove: (id: string) => void;
  onUnapprove: (id: string) => void;
  onDelete: (id: string) => void;
};

export function CorrectionsPanel({
  isOpen,
  onClose,
  corrections,
  onApprove,
  onUnapprove,
  onDelete,
}: CorrectionsPanelProps) {
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");

  if (!isOpen) return null;

  const filteredCorrections = corrections.filter((c) =>
    filter === "all" ? true : filter === "approved" ? c.approved : !c.approved
  );

  const approvedCount = corrections.filter((c) => c.approved).length;

  return (
    <>
      <div
        className="no-print fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="no-print fixed inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-sm font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Correções Salvas
            </span>
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70">({approvedCount} aprovadas)</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex gap-2">
          {(["all", "approved", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {f === "all" ? "Todas" : f === "approved" ? "Aprovadas" : "Pendentes"}
            </button>
          ))}
        </div>

        {/* Corrections list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredCorrections.map((correction) => (
            <CorrectionCard
              key={correction.id}
              correction={correction}
              onApprove={() => onApprove(correction.id)}
              onUnapprove={() => onUnapprove(correction.id)}
              onDelete={() => {
                if (confirm("Excluir esta correção?")) {
                  onDelete(correction.id);
                }
              }}
            />
          ))}

          {corrections.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">Nenhuma correção capturada ainda</p>
              <p className="text-xs mt-1">Edite um relatório gerado para criar correções</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- Sub-component ---

type CorrectionCardProps = {
  correction: Correction;
  onApprove: () => void;
  onUnapprove: () => void;
  onDelete: () => void;
};

function CorrectionCard({ correction, onApprove, onUnapprove, onDelete }: CorrectionCardProps) {
  const fieldColors = {
    analise: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    conduta: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    receita: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        correction.approved
          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              fieldColors[correction.field] || "bg-slate-100 text-slate-700"
            }`}
          >
            {correction.field}
          </span>
          {correction.approved && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Aprovada
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {new Date(correction.timestamp).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!correction.approved ? (
            <button
              onClick={onApprove}
              className="p-1.5 rounded text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              title="Aprovar como exemplo"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onUnapprove}
              className="p-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Remover aprovação"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="Excluir"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {correction.patientContext.name && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          Paciente: {correction.patientContext.name}
          {correction.patientContext.age && `, ${correction.patientContext.age} anos`}
        </p>
      )}

      <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
        <span className="font-medium text-slate-500 dark:text-slate-400">Alteração: </span>
        {getDiffSummary(correction.original, correction.corrected)}
      </div>

      {correction.doctorNote && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 mt-2">
          Nota: {correction.doctorNote}
        </p>
      )}
    </div>
  );
}
