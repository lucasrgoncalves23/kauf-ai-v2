"use client";

import { useState } from "react";
import { X, Check, Ban, Trash2, FileText } from "lucide-react";
import type { Correction } from "../lib/corrections";
import { getDiffSummary } from "../lib/corrections";
import { ConfirmDialog } from "./ui/ConfirmDialog";

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredCorrections = corrections.filter((c) =>
    filter === "all" ? true : filter === "approved" ? c.approved : !c.approved
  );

  const approvedCount = corrections.filter((c) => c.approved).length;

  return (
    <>
      <div
        className="no-print fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />
      <div className="no-print fixed inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-w-3xl mx-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Correções Salvas
            </span>
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70">({approvedCount} aprovadas)</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
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
              onDelete={() => setConfirmDeleteId(correction.id)}
            />
          ))}

          {corrections.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" strokeWidth={1} />
              <p className="text-sm">Nenhuma correção capturada ainda</p>
              <p className="text-xs mt-1">Edite um relatório gerado para criar correções</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        danger
        title="Excluir esta correção?"
        message="A correção deixará de ser usada como exemplo nas próximas gerações."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (confirmDeleteId) onDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
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
            className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
              fieldColors[correction.field] || "bg-slate-100 text-slate-700"
            }`}
          >
            {correction.field}
          </span>
          {correction.approved && (
            <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Aprovada
            </span>
          )}
          <span className="text-2xs text-slate-400">
            {new Date(correction.timestamp).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!correction.approved ? (
            <button
              onClick={onApprove}
              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              title="Aprovar como exemplo"
            >
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onUnapprove}
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Remover aprovação"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {correction.patientContext.name && (
        <p className="text-2xs text-slate-500 dark:text-slate-400 mb-2">
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
