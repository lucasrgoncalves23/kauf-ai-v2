"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  Check,
  Copy,
  PencilLine,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { ChatEdit, ChatMessage } from "../types/clinical";
import { FIELD_LABELS } from "../hooks/useCopilotChat";
import { renderChatMarkdown } from "../utils/markdown";

type ChatSize = "panel" | "fullscreen";

const SIZES = {
  panel: {
    scroller: "p-4 compact:p-3",
    column: "space-y-4 compact:space-y-3",
    text: "text-[13px] compact:text-xs",
    userBubble: "max-w-[85%] px-3.5 py-2.5 text-[13px] compact:px-2.5 compact:py-2 compact:text-xs",
    fade: "from-ai-50/70 dark:from-slate-900/50",
  },
  fullscreen: {
    scroller: "p-6",
    column: "max-w-3xl mx-auto space-y-5",
    text: "text-sm",
    userBubble: "max-w-[70%] px-4 py-2.5 text-sm",
    fade: "from-white/90 dark:from-slate-900/90",
  },
} as const;

const ACTION_LABELS: Record<ChatEdit["action"], string> = {
  edit: "trecho editado",
  append: "trecho adicionado",
  set: "documento reescrito",
};

const FIELD_CHIP: Record<ChatEdit["field"], string> = {
  analise:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  conduta:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  receita:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
};

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1.5" aria-label="Pensando">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-ai-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function DiffRow({ kind, text }: { kind: "removed" | "added"; text: string }) {
  return (
    <div
      className={`flex gap-1.5 px-2 py-1 rounded ${
        kind === "removed"
          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
          : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
      }`}
    >
      <span
        className={`select-none font-semibold ${
          kind === "removed" ? "text-red-400 dark:text-red-500" : "text-emerald-400 dark:text-emerald-500"
        }`}
      >
        {kind === "removed" ? "−" : "+"}
      </span>
      <span className="min-w-0">{text}</span>
    </div>
  );
}

function EditCard({
  edits,
  undone,
  canUndo,
  onUndo,
}: {
  edits: ChatEdit[];
  undone: boolean;
  canUndo: boolean;
  onUndo: () => void;
}) {
  return (
    <div
      className={`w-full rounded-xl border border-slate-200/80 dark:border-slate-600/80 border-l-2 border-l-ai-400 dark:border-l-ai-500 bg-white dark:bg-slate-700/60 p-3 space-y-2 text-2xs shadow-sm ${
        undone ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-ai-700 dark:text-ai-300 uppercase tracking-wider">
          <PencilLine className="w-3.5 h-3.5" />
          {undone ? "Alterações desfeitas" : "Alterações aplicadas"}
        </span>
        {canUndo && !undone && (
          <button
            onClick={onUndo}
            className="flex items-center gap-1 px-2 py-1 rounded-md font-medium text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-slate-200 dark:border-slate-600 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            Desfazer
          </button>
        )}
      </div>
      {edits.map((edit, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded border font-semibold ${FIELD_CHIP[edit.field]}`}
            >
              {FIELD_LABELS[edit.field]}
            </span>
            <span className="text-slate-400 dark:text-slate-500">{ACTION_LABELS[edit.action]}</span>
          </div>
          {edit.before && <DiffRow kind="removed" text={edit.before} />}
          {edit.after && <DiffRow kind="added" text={edit.after} />}
        </div>
      ))}
    </div>
  );
}

type ChatThreadProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingId?: string | null;
  suggestions: string[];
  onSuggestion: (text: string) => void;
  onRetry: () => void;
  onUndoEdits: (messageId: string) => void;
  undoableIds: string[];
  size?: ChatSize;
};

export function ChatThread({
  messages,
  isLoading,
  streamingId,
  suggestions,
  onSuggestion,
  onRetry,
  onUndoEdits,
  undoableIds,
  size = "panel",
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const sz = SIZES[size];

  useEffect(() => {
    if (nearBottomRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else if (messages.length > 0) {
      const id = requestAnimationFrame(() => setShowJump(true));
      return () => cancelAnimationFrame(id);
    }
  }, [messages, isLoading]);

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowJump(false);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    nearBottomRef.current = near;
    if (near) setShowJump(false);
  };

  const copyMessage = (id: string | number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto ${sz.scroller}`}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 compact:p-3">
            <Sparkles className="w-5 h-5 text-ai-300 dark:text-ai-700 mb-2" />
            <p className="text-2xs text-slate-400 dark:text-slate-500 mb-3">
              Pergunte qualquer coisa sobre o caso.
            </p>
            <div className="flex flex-col items-center gap-1.5 w-full">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggestion(s)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ai-200/70 dark:border-ai-800/70 bg-white/60 dark:bg-slate-700/40 text-2xs font-medium text-slate-600 dark:text-slate-300 hover:border-ai-300 dark:hover:border-ai-700 hover:text-ai-700 dark:hover:text-ai-300 hover:bg-ai-50 dark:hover:bg-ai-900/30 transition-colors text-left"
                >
                  <Sparkles className="w-3 h-3 shrink-0 text-ai-400" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={sz.column}>
            {messages.map((msg, i) => {
              const key = msg.id ?? i;
              const isStreaming = msg.id !== undefined && msg.id === streamingId;
              const isLast = i === messages.length - 1;

              if (msg.role === "user") {
                return (
                  <div key={key} className="animate-message-in flex justify-end">
                    <div
                      className={`${sz.userBubble} rounded-2xl leading-relaxed whitespace-pre-wrap bg-slate-200/70 dark:bg-slate-600/60 text-slate-800 dark:text-slate-100`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const isErrorOnly = !!msg.error && !msg.content;
              return (
                <div key={key} className="animate-message-in flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 mt-1 shrink-0 text-ai-500" />
                  <div className="group min-w-0 flex-1 flex flex-col items-start gap-1.5">
                    {isStreaming && !msg.content ? (
                      <TypingDots />
                    ) : isErrorOnly ? (
                      <div
                        className={`${sz.text} w-fit px-3 py-2 rounded-xl leading-relaxed bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200/70 dark:border-red-800/70`}
                      >
                        {msg.error}
                      </div>
                    ) : (
                      <div
                        className={`${sz.text} w-full leading-relaxed text-slate-700 dark:text-slate-200`}
                      >
                        {renderChatMarkdown(msg.content)}
                        {isStreaming && (
                          <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle bg-ai-500 animate-caret" />
                        )}
                      </div>
                    )}

                    {msg.edits && (
                      <EditCard
                        edits={msg.edits}
                        undone={!!msg.undone}
                        canUndo={msg.id !== undefined && undoableIds.includes(msg.id)}
                        onUndo={() => msg.id && onUndoEdits(msg.id)}
                      />
                    )}

                    {msg.failures && (
                      <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-2xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span>
                          {msg.failures.length} alteração(ões) não aplicada(s):{" "}
                          {msg.failures.join("; ")}. Peça de novo de outro jeito.
                        </span>
                      </div>
                    )}

                    {msg.error && msg.content && (
                      <div className="flex items-center gap-1.5 text-2xs text-red-600 dark:text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {msg.error}
                      </div>
                    )}

                    {msg.error && isLast && !isLoading && (
                      <button
                        onClick={onRetry}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Tentar novamente
                      </button>
                    )}

                    {!isStreaming && msg.content && !msg.error && (
                      <button
                        onClick={() => copyMessage(key, msg.content)}
                        aria-label="Copiar resposta"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex items-center gap-1 px-1.5 py-0.5 -ml-1.5 rounded text-2xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                      >
                        {copiedId === key ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copiar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Soft fade into the composer instead of a hard border */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t to-transparent ${sz.fade}`}
      />

      {showJump && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 dark:bg-slate-600 text-white text-2xs font-medium shadow-lg hover:bg-slate-700 transition-colors animate-fade-in"
        >
          <ArrowDown className="w-3 h-3" />
          Nova mensagem
        </button>
      )}
    </div>
  );
}

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  size?: ChatSize;
  autoFocus?: boolean;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  isLoading,
  size = "panel",
  autoFocus,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, size === "panel" ? 120 : 160)}px`;
  }, [value, size]);

  const canSend = !isLoading && value.trim().length > 0;

  return (
    <div
      className={`flex items-end gap-2 bg-white dark:bg-slate-700 rounded-2xl border border-slate-200/70 dark:border-slate-600/70 shadow-sm focus-within:border-ai-300 dark:focus-within:border-ai-700 focus-within:ring-2 focus-within:ring-ai-100 dark:focus-within:ring-ai-900/50 transition-all ${
        size === "panel" ? "p-1.5 compact:p-1" : "p-2 max-w-3xl mx-auto w-full"
      }`}
    >
      <textarea
        ref={ref}
        rows={1}
        className={`flex-1 bg-transparent outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white ${
          size === "panel"
            ? "px-3 py-2 text-xs compact:px-2 compact:py-1.5 compact:text-2xs"
            : "px-3 py-2 text-sm"
        }`}
        placeholder="Pergunte ao KAUAI..."
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        aria-label="Enviar"
        className={`rounded-xl transition-all flex-shrink-0 ${
          size === "panel" ? "p-2 compact:p-1.5" : "p-2.5"
        } ${
          canSend
            ? "bg-ai-600 text-white hover:bg-ai-700 shadow-sm"
            : "bg-slate-100 dark:bg-slate-600 text-slate-400 dark:text-slate-400"
        }`}
      >
        <SendHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}
