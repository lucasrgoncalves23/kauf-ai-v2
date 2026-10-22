"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, Square, X } from "lucide-react";
import { getPinHeaders } from "../../../lib/api-client";
import { CONTENT_KEYS, type ContentKey, type PortalContent } from "../../../lib/portal/schema";
import { EDITOR_SECTIONS, type EditorSectionId } from "./PortalContentEditor";
import type { PortalEditorApi } from "./usePortalEditor";

type Turn = { role: "medico" | "ia"; text: string; error?: boolean };

const QUICK_ACTIONS = [
  { label: "Mais simples", instruction: "Deixe o texto mais simples, para um paciente sem nenhum conhecimento médico." },
  { label: "Mais curto", instruction: "Deixe os textos mais curtos e diretos, sem perder informação importante." },
  { label: "Tom mais acolhedor", instruction: "Deixe o tom mais acolhedor e próximo, sem infantilizar e sem perder a objetividade." },
  { label: "Sem termos técnicos", instruction: "Troque qualquer termo técnico ou sigla que ainda reste por linguagem do dia a dia." },
];

type PortalCopilotProps = {
  editor: PortalEditorApi;
  patientId: string;
  consultaId: string;
  scope: EditorSectionId | null;
  onClearScope: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  focusNonce: number;
};

export function PortalCopilot({ editor, patientId, consultaId, scope, onClearScope, busy, setBusy, focusNonce }: PortalCopilotProps) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const scopeSection = scope ? EDITOR_SECTIONS.find((s) => s.id === scope) : null;

  useEffect(() => {
    if (focusNonce) inputRef.current?.focus();
  }, [focusNonce]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (instruction: string) => {
    const text = instruction.trim();
    if (!text || busy) return;
    const history = turns.filter((t) => !t.error).map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "medico", text }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/portal/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({
          patientId,
          consultaId,
          content: editor.content,
          instruction: text,
          scope: scopeSection?.keys ?? [],
          history,
        }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        content?: PortalContent;
        changed?: string[];
        summary?: string;
        question?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      if (data.content) {
        const keys = (data.changed ?? []).filter((k): k is ContentKey => (CONTENT_KEYS as readonly string[]).includes(k));
        if (keys.length) {
          editor.applyAi(data.content, keys, data.summary || "Alteração aplicada.");
          setTurns((t) => [...t, { role: "ia", text: data.summary || "Alteração aplicada." }]);
        } else {
          setTurns((t) => [...t, { role: "ia", text: data.question || "Nada precisou mudar com esse pedido." }]);
        }
      } else {
        setTurns((t) => [...t, { role: "ia", text: data.question || "Pode detalhar o que deseja alterar?" }]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setTurns((t) => [...t, { role: "ia", text: "Pedido cancelado.", error: true }]);
      } else {
        setTurns((t) => [...t, { role: "ia", text: err instanceof Error ? err.message : "Falha ao aplicar a alteração.", error: true }]);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      {turns.length > 0 && (
        <div ref={logRef} className="mb-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <p
              key={i}
              className={`text-xs leading-relaxed ${
                t.role === "medico" ? "text-slate-500 dark:text-slate-400" : t.error ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200"
              }`}
            >
              <span className="font-semibold">{t.role === "medico" ? "Você: " : "IA: "}</span>
              {t.text}
            </p>
          ))}
          {busy && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Aplicando a alteração…
            </p>
          )}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-brand-500" />
        {scopeSection && (
          <span className="flex items-center gap-1 rounded-full bg-brand-100 py-0.5 pl-2 pr-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            Só: {scopeSection.title}
            <button type="button" onClick={onClearScope} title="Aplicar a todo o conteúdo" className="rounded-full p-0.5 hover:bg-brand-200 dark:hover:bg-brand-800">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={busy}
            onClick={() => send(a.instruction)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={
            scopeSection
              ? `O que mudar em "${scopeSection.title}"?`
              : "Peça uma alteração. Ex.: \"inclua nas prioridades dormir antes das 23h\""
          }
          className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            title="Cancelar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim()}
            title="Enviar (Enter)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-600"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
