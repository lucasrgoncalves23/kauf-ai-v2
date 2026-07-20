"use client";

import { useState } from "react";
import { Eraser, Maximize2, Sparkles } from "lucide-react";
import type { ChatMessage } from "../types/clinical";
import { ChatThread, ChatComposer } from "./ChatThread";
import { ConfirmDialog } from "./ui";

type CopilotChatProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  isLoading: boolean;
  streamingId: string | null;
  suggestions: string[];
  undoableIds: string[];
  onRetry: () => void;
  onUndoEdits: (messageId: string) => void;
  onClearChat: () => void;
  onOpenFullscreen: () => void;
};

export function CopilotChat({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  streamingId,
  suggestions,
  undoableIds,
  onRetry,
  onUndoEdits,
  onClearChat,
  onOpenFullscreen,
}: CopilotChatProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200/40 dark:border-slate-700/40 px-5 py-3 compact:px-3 compact:py-2">
        <span className="flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
          <Sparkles className="w-3.5 h-3.5 text-ai-500" />
          Copiloto KAUAI
        </span>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title="Limpar conversa"
            >
              <Eraser className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onOpenFullscreen}
            className="p-1.5 rounded-lg text-slate-400 hover:text-ai-600 hover:bg-ai-50 dark:hover:bg-ai-900/30 transition-colors"
            title="Tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ChatThread
        messages={messages}
        isLoading={isLoading}
        streamingId={streamingId}
        suggestions={suggestions}
        onSuggestion={(text) => onSend(text)}
        onRetry={onRetry}
        onUndoEdits={onUndoEdits}
        undoableIds={undoableIds}
        size="panel"
      />

      {/* Input — floats on the panel; the thread fades into it */}
      <div className="flex-shrink-0 px-3 pb-3 pt-1 compact:px-2 compact:pb-2">
        <ChatComposer
          value={input}
          onChange={onInputChange}
          onSend={() => onSend()}
          isLoading={isLoading}
          size="panel"
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
  );
}
