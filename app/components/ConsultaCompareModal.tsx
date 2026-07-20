"use client";

import { useMemo, useState } from "react";
import type { ClinicalData, ClinicalOutputs, Consulta } from "../types/clinical";
import { diffLines, diffStats, type DiffLine } from "../lib/textDiff";

type ConsultaCompareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  consultas: Consulta[];
  currentInputs: ClinicalData;
  currentOutputs: ClinicalOutputs;
  patientName: string;
};

type Section = {
  key: string;
  label: string;
  getOld: (c: Consulta) => string;
  getNew: () => string;
  defaultOpen: boolean;
};

function fullDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "?";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DiffColumn({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.type === "removed"
              ? "bg-rose-50 dark:bg-rose-900/25 text-rose-800 dark:text-rose-300 px-1 -mx-1 rounded-sm"
              : line.type === "added"
                ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-300 px-1 -mx-1 rounded-sm"
                : undefined
          }
        >
          {line.text || " "}
        </div>
      ))}
    </div>
  );
}

function CompareSection({
  label,
  oldText,
  newText,
  oldDateLabel,
  defaultOpen,
}: {
  label: string;
  oldText: string;
  newText: string;
  oldDateLabel: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const diff = useMemo(() => diffLines(oldText, newText), [oldText, newText]);
  const stats = useMemo(() => diffStats(diff), [diff]);
  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="flex items-center gap-2">
          {hasChanges ? (
            <span className="text-[9px] text-slate-400 dark:text-slate-500">
              {stats.added > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">+{stats.added} </span>
              )}
              {stats.removed > 0 && (
                <span className="text-rose-600 dark:text-rose-400">−{stats.removed}</span>
              )}
            </span>
          ) : (
            <span className="text-[9px] text-slate-300 dark:text-slate-600">sem alterações</span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-slate-100 dark:border-slate-700">
          <div className="p-4 md:border-r border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {oldDateLabel}
            </p>
            {oldText.trim() ? (
              <DiffColumn lines={diff.left} />
            ) : (
              <p className="text-[11px] text-slate-300 dark:text-slate-600 italic">vazio</p>
            )}
          </div>
          <div className="p-4 border-t md:border-t-0 border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
              Hoje (sessão atual)
            </p>
            {newText.trim() ? (
              <DiffColumn lines={diff.right} />
            ) : (
              <p className="text-[11px] text-slate-300 dark:text-slate-600 italic">vazio</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConsultaCompareModal({
  isOpen,
  onClose,
  consultas,
  currentInputs,
  currentOutputs,
  patientName,
}: ConsultaCompareModalProps) {
  const sorted = useMemo(
    () =>
      [...consultas].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [consultas]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find((c) => c.id === selectedId) || sorted[0];

  if (!isOpen) return null;

  const sections: Section[] = [
    { key: "conduta", label: "Conduta Terapêutica", getOld: (c) => c.outputs?.conduta || "", getNew: () => currentOutputs.conduta, defaultOpen: true },
    { key: "analise", label: "Análise Clínica", getOld: (c) => c.outputs?.analise || "", getNew: () => currentOutputs.analise, defaultOpen: false },
    { key: "receita", label: "Receita", getOld: (c) => c.outputs?.receita || "", getNew: () => currentOutputs.receita, defaultOpen: false },
    { key: "anamnese", label: "Anamnese", getOld: (c) => c.inputs?.anamnese || "", getNew: () => currentInputs.anamnese, defaultOpen: false },
    { key: "laboratoriais", label: "Laboratoriais", getOld: (c) => c.inputs?.laboratoriais || "", getNew: () => currentInputs.laboratoriais, defaultOpen: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-full overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Comparar Consultas
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{patientName || "Paciente"}</p>
          </div>
          <div className="flex items-center gap-2">
            {sorted.length > 0 && (
              <select
                value={selected?.id || ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-300"
              >
                {sorted.map((c) => (
                  <option key={c.id} value={c.id}>
                    Consulta de {fullDate(c.timestamp)}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fechar (Esc)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!selected ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">
            Nenhuma consulta salva ainda. Use &quot;Salvar Consulta&quot; ao final de cada
            atendimento para poder comparar visitas.
          </p>
        ) : (
          <div className="space-y-3">
            {sections
              .filter((s) => s.getOld(selected).trim() || s.getNew().trim())
              .map((s) => (
                <CompareSection
                  key={`${selected.id}-${s.key}`}
                  label={s.label}
                  oldText={s.getOld(selected)}
                  newText={s.getNew()}
                  oldDateLabel={`Consulta de ${fullDate(selected.timestamp)}`}
                  defaultOpen={s.defaultOpen}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
