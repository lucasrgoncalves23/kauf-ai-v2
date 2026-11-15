"use client";

/**
 * CRM Inbox — what the Clinic OS CRM pushed for the open patient:
 *  - pre-consulta briefing (what the patient said on WhatsApp since the last
 *    consulta) → "Adicionar à anamnese" appends it to the anamnese input;
 *  - exams the patient sent on WhatsApp (extracted text) → "Importar para
 *    laboratoriais" appends them to the Laboratoriais input.
 * The doctor decides; nothing is injected into prompts automatically.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FlaskConical, MessageSquareText, Check } from "lucide-react";
import { getPinHeaders } from "../lib/api-client";
import { formatImportedExam } from "../lib/examFormat";
import type { ToastState } from "../types/clinical";
import { SectionLabel } from "./ui/SectionLabel";

type Briefing = {
  id: string;
  consultaEm: string | null;
  periodoDe: string | null;
  periodoAte: string | null;
  texto: string;
  fontes: { mensagens?: number; checkins?: number; intake?: boolean };
  createdAt: string;
  usedAt: string | null;
};

type Exam = {
  id: string;
  filename: string | null;
  caption: string | null;
  texto: string;
  method: string | null;
  recebidoEm: string;
  importedAt: string | null;
};

type Props = {
  patientId: string | null;
  onAppend: (field: "anamnese" | "laboratoriais", text: string) => void;
  setToast: (toast: ToastState) => void;
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function CrmInboxCard({ patientId, onAppend, setToast }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // State resets per patient via the `key` prop set by the page (no sync setState here).
  const load = useCallback(() => {
    if (!patientId) return;
    const q = `patientId=${encodeURIComponent(patientId)}`;
    fetch(`/api/crm/briefings?${q}`, { headers: getPinHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBriefings(data?.briefings ?? []))
      .catch(() => setBriefings([]));
    fetch(`/api/crm/exams?${q}`, { headers: getPinHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setExams(data?.exams ?? []))
      .catch(() => setExams([]));
  }, [patientId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  async function applyBriefing(b: Briefing) {
    onAppend("anamnese", b.texto);
    setBriefings((prev) => prev.map((x) => (x.id === b.id ? { ...x, usedAt: new Date().toISOString() } : x)));
    fetch("/api/crm/briefings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getPinHeaders() },
      body: JSON.stringify({ id: b.id }),
    }).catch(() => {});
    setToast({ message: "Relato do WhatsApp adicionado à anamnese", type: "success" });
  }

  async function importExam(e: Exam) {
    onAppend("laboratoriais", formatImportedExam(e.texto, e.recebidoEm, e.caption));
    setExams((prev) => prev.map((x) => (x.id === e.id ? { ...x, importedAt: new Date().toISOString() } : x)));
    fetch("/api/crm/exams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getPinHeaders() },
      body: JSON.stringify({ id: e.id }),
    }).catch(() => {});
    setToast({ message: "Exame importado para Laboratoriais", type: "success" });
  }

  const latest = briefings[0];
  if (!latest && exams.length === 0) return null;

  const card =
    "rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-4 compact:p-3";
  const btn =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-default";
  const ghost =
    "inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";

  return (
    <div className="mt-4 compact:mt-2">
      <SectionLabel>Do WhatsApp (CRM)</SectionLabel>
      <div className="space-y-3">
        {latest && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquareText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Relato do paciente
              </span>
              <span className="ml-auto text-2xs text-slate-400">
                {fmt(latest.periodoDe)}–{fmt(latest.periodoAte)}
              </span>
            </div>
            <p className="text-2xs text-slate-400 mb-2">
              {[
                latest.fontes.mensagens ? `${latest.fontes.mensagens} mensagens` : null,
                latest.fontes.checkins ? `${latest.fontes.checkins} check-ins` : null,
                latest.fontes.intake ? "formulário pré-consulta" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "sem detalhes das fontes"}
              {latest.consultaEm && ` · consulta ${fmt(latest.consultaEm)}`}
            </p>
            <pre
              className={`whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 dark:text-slate-300 ${
                expanded[latest.id] ? "" : "max-h-32 overflow-hidden"
              }`}
            >
              {latest.texto}
            </pre>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [latest.id]: !p[latest.id] }))}
                className={ghost}
              >
                {expanded[latest.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded[latest.id] ? "Recolher" : "Ver tudo"}
              </button>
              <button onClick={() => applyBriefing(latest)} disabled={!!latest.usedAt} className={btn}>
                {latest.usedAt ? <Check className="w-3.5 h-3.5" /> : null}
                {latest.usedAt ? "Na anamnese" : "Adicionar à anamnese"}
              </button>
            </div>
          </div>
        )}

        {exams.length > 0 && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Exames recebidos
              </span>
            </div>
            <ul className="space-y-2">
              {exams.map((e) => (
                <li key={e.id} className="border-t border-slate-100 dark:border-slate-700 pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      {fmt(e.recebidoEm)}
                      {e.caption ? ` · ${e.caption}` : e.filename ? ` · ${e.filename}` : ""}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                        className={ghost}
                      >
                        {expanded[e.id] ? "Ocultar" : "Ver texto"}
                      </button>
                      {e.importedAt ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" /> Importado
                        </span>
                      ) : (
                        <button onClick={() => importExam(e)} className={btn}>
                          Importar para laboratoriais
                        </button>
                      )}
                    </span>
                  </div>
                  {expanded[e.id] && (
                    <pre className="mt-1.5 whitespace-pre-wrap font-sans text-2xs leading-relaxed text-slate-600 dark:text-slate-400 max-h-48 overflow-y-auto">
                      {e.texto}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
