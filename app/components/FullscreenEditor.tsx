"use client";

import { X, SendHorizontal, Lightbulb, Sparkles } from "lucide-react";
import type { ClinicalOutputs, ChatMessage } from "../types/clinical";
import { renderSimpleMarkdown } from "../utils/markdown";

type FullscreenEditorProps = {
  panel: "analise" | "conduta" | "receita" | "copilot" | null;
  onClose: () => void;
  outputs: ClinicalOutputs;
  onOutputChange: (field: keyof ClinicalOutputs, value: string) => void;
  onSaveAsExample: (field: "analise" | "conduta" | "receita") => void;
  // Copilot props
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: () => void;
  isChatLoading: boolean;
};

export function FullscreenEditor({
  panel,
  onClose,
  outputs,
  onOutputChange,
  onSaveAsExample,
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendMessage,
  isChatLoading,
}: FullscreenEditorProps) {
  if (!panel) return null;

  // Copilot fullscreen
  if (panel === "copilot") {
    return (
      <>
        <div
          className="no-print fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
          onClick={onClose}
        />
        <div className="no-print fixed inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/20">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Copiloto KAUAI
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-xs">
                  Copiloto KAUAI
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-2xs italic">
                  &quot;Por que o paciente está na Fase A?&quot;
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed font-medium shadow-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-800 dark:bg-slate-600 text-white rounded-tr-none"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-tl-none"
                  }`}
                >
                  {msg.role === "assistant" ? renderSimpleMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="text-2xs text-slate-400 dark:text-slate-500 animate-pulse ml-2 font-medium">
                Pensando...
              </div>
            )}
          </div>
          {/* Input */}
          <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900 p-2">
              <input
                className="flex-1 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white px-3 py-2 text-sm"
                placeholder="Pergunte ao KAUAI..."
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
                autoFocus
              />
              <button
                onClick={onSendMessage}
                disabled={isChatLoading}
                aria-label="Enviar"
                className="bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 transition-all disabled:opacity-50 p-2.5"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Output editor (analise, conduta, receita)
  const config = {
    analise: {
      title: "Análise Clínica Integrada",
      bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
      dotClass: "bg-emerald-500",
      textClass: "text-emerald-700 dark:text-emerald-300",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
    },
    conduta: {
      title: "Conduta & Planejamento",
      bgClass: "bg-indigo-50 dark:bg-indigo-900/20",
      dotClass: "bg-indigo-500",
      textClass: "text-indigo-700 dark:text-indigo-300",
      buttonClass: "bg-indigo-600 hover:bg-indigo-700",
    },
    receita: {
      title: "Receita Médica",
      bgClass: "bg-rose-50 dark:bg-rose-900/20",
      dotClass: "bg-rose-500",
      textClass: "text-rose-700 dark:text-rose-300",
      buttonClass: "bg-rose-600 hover:bg-rose-700",
    },
  }[panel];

  return (
    <>
      <div
        className="no-print fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />
      <div className="no-print fixed inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 ${config.bgClass}`}
        >
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${config.dotClass}`}></span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${config.textClass}`}>
              {config.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Editor */}
        <textarea
          className="flex-1 w-full p-6 text-sm leading-relaxed bg-transparent outline-none resize-none text-slate-800 dark:text-slate-200 font-mono"
          value={outputs[panel]}
          onChange={(e) => onOutputChange(panel, e.target.value)}
          placeholder="Conteúdo vazio..."
          autoFocus
        />
        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <span className="text-xs text-slate-400">{outputs[panel].length} caracteres</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSaveAsExample(panel)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 transition-colors flex items-center gap-1.5"
              title="Salvar esta correção como exemplo para treinar a IA"
            >
              <Lightbulb className="w-4 h-4" />
              Salvar como exemplo
            </button>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${config.buttonClass}`}
            >
              Salvar e fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
