"use client";

import { useState } from "react";
import { X, Eraser, Lightbulb, Sparkles } from "lucide-react";
import type { ClinicalOutputs, ClinicalData, ChatMessage } from "../types/clinical";
import { ChatThread, ChatComposer } from "./ChatThread";
import { ConfirmDialog } from "./ui";

type FullscreenEditorProps = {
  panel: "analise" | "conduta" | "receita" | "copilot" | "bioimpedancia" | "laboratoriais" | "genetica" | "wearable" | null;
  onClose: () => void;
  outputs: ClinicalOutputs;
  onOutputChange: (field: keyof ClinicalOutputs, value: string) => void;
  onSaveAsExample: (field: "analise" | "conduta" | "receita") => void;
  inputs?: ClinicalData;
  onInputChange?: (field: keyof ClinicalData, value: string) => void;
  // Copilot props
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: (text?: string) => void;
  isChatLoading: boolean;
  chatStreamingId: string | null;
  chatSuggestions: string[];
  chatUndoableIds: string[];
  onChatRetry: () => void;
  onChatUndoEdits: (messageId: string) => void;
  onClearChat: () => void;
};

const INPUT_CONFIG: Record<keyof ClinicalData, { title: string; bgClass: string; textClass: string }> = {
  anamnese: {
    title: "Anamnese",
    bgClass: "bg-blue-50 dark:bg-blue-900/20",
    textClass: "text-blue-700 dark:text-blue-300",
  },
  bioimpedancia: {
    title: "Bioimpedância",
    bgClass: "bg-purple-50 dark:bg-purple-900/20",
    textClass: "text-purple-700 dark:text-purple-300",
  },
  laboratoriais: {
    title: "Laboratoriais",
    bgClass: "bg-cyan-50 dark:bg-cyan-900/20",
    textClass: "text-cyan-700 dark:text-cyan-300",
  },
  genetica: {
    title: "Genética",
    bgClass: "bg-orange-50 dark:bg-orange-900/20",
    textClass: "text-orange-700 dark:text-orange-300",
  },
  wearable: {
    title: "Wearable",
    bgClass: "bg-pink-50 dark:bg-pink-900/20",
    textClass: "text-pink-700 dark:text-pink-300",
  },
};

export function FullscreenEditor({
  panel,
  onClose,
  outputs,
  onOutputChange,
  onSaveAsExample,
  inputs,
  onInputChange,
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendMessage,
  isChatLoading,
  chatStreamingId,
  chatSuggestions,
  chatUndoableIds,
  onChatRetry,
  onChatUndoEdits,
  onClearChat,
}: FullscreenEditorProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  if (!panel) return null;

  // Input panels
  const inputKeys = ["bioimpedancia", "laboratoriais", "genetica", "wearable"] as const;
  const isInputPanel = inputKeys.includes(panel as any);

  if (isInputPanel && inputs) {
    const key = panel as keyof ClinicalData;
    const config = INPUT_CONFIG[key];
    return (
      <>
        <div
          className="no-print fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
          onClick={onClose}
        />
        <div className="no-print fixed inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 ${config.bgClass}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${config.textClass}`}>
              {config.title}
            </span>
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
            className="flex-1 w-full p-6 text-sm leading-relaxed bg-transparent outline-none resize-none text-slate-800 dark:text-slate-200"
            value={inputs[key]}
            onChange={(e) => onInputChange?.(key, e.target.value)}
            placeholder="Cole ou digite aqui..."
            autoFocus
          />
          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <span className="text-xs text-slate-400">{inputs[key].length} caracteres</span>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600`}
            >
              Concluir
            </button>
          </div>
        </div>
      </>
    );
  }

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
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-ai-50 dark:bg-ai-900/20">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-ai-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ai-700 dark:text-ai-300">
                Copiloto KAUAI
              </span>
            </div>
            <div className="flex items-center gap-1">
              {chatMessages.length > 0 && (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Limpar conversa"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <ChatThread
            messages={chatMessages}
            isLoading={isChatLoading}
            streamingId={chatStreamingId}
            suggestions={chatSuggestions}
            onSuggestion={(text) => onSendMessage(text)}
            onRetry={onChatRetry}
            onUndoEdits={onChatUndoEdits}
            undoableIds={chatUndoableIds}
            size="fullscreen"
          />

          {/* Input — floats below the thread fade */}
          <div className="px-6 pb-5 pt-1">
            <ChatComposer
              value={chatInput}
              onChange={onChatInputChange}
              onSend={() => onSendMessage()}
              isLoading={isChatLoading}
              size="fullscreen"
              autoFocus
            />
          </div>

          <ConfirmDialog
            open={confirmClear}
            title="Limpar conversa?"
            message="O histórico do chat deste paciente será apagado. As alterações já aplicadas nos documentos permanecem."
            confirmLabel="Limpar"
            danger
            onConfirm={() => {
              onClearChat();
              setConfirmClear(false);
            }}
            onCancel={() => setConfirmClear(false)}
          />
        </div>
      </>
    );
  }

  // Output editor (analise, conduta, receita)
  const outputKeys = ["analise", "conduta", "receita"] as const;
  const isOutputPanel = outputKeys.includes(panel as any);

  if (!isOutputPanel) return null;

  const outputPanel = panel as "analise" | "conduta" | "receita";
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
  }[outputPanel];

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
          value={outputs[outputPanel]}
          onChange={(e) => onOutputChange(outputPanel, e.target.value)}
          placeholder="Conteúdo vazio..."
          autoFocus
        />
        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <span className="text-xs text-slate-400">{outputs[outputPanel].length} caracteres</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSaveAsExample(outputPanel)}
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
