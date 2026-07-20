"use client";

import { useRef, useEffect } from "react";
import { Maximize2, SendHorizontal, Sparkles } from "lucide-react";
import type { ChatMessage } from "../types/clinical";
import { renderSimpleMarkdown } from "../utils/markdown";

type CopilotChatProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onOpenFullscreen: () => void;
};

export function CopilotChat({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  onOpenFullscreen,
}: CopilotChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30 px-5 py-3 compact:px-3 compact:py-2">
        <span className="flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Copiloto KAUAI
        </span>
        <button
          onClick={onOpenFullscreen}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
          title="Tela cheia"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 compact:p-3 compact:space-y-2" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 compact:p-3">
            <Sparkles className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-2xs text-slate-400 dark:text-slate-500">
              Pergunte qualquer coisa sobre o caso.
            </p>
            <p className="text-2xs text-slate-300 dark:text-slate-600 mt-1 italic">
              &quot;Por que o paciente está na Fase A?&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-2xl leading-relaxed shadow-sm whitespace-pre-wrap p-3.5 text-[13px] compact:p-2 compact:text-xs font-medium ${
                msg.role === "user"
                  ? "bg-slate-800 dark:bg-slate-600 text-white rounded-tr-none"
                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-600 rounded-tl-none"
              }`}
            >
              {msg.role === "assistant" ? renderSimpleMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-2xs text-slate-400 dark:text-slate-500 animate-pulse ml-2 font-medium">
            Pensando...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 p-4 compact:p-2">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-brand-100 dark:focus-within:ring-brand-900 transition-all p-1.5 compact:p-1">
          <input
            className="flex-1 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white px-3 py-2 text-xs compact:px-2 compact:py-1.5 compact:text-2xs"
            placeholder="Pergunte ao KAUAI..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <button
            onClick={onSend}
            disabled={isLoading}
            aria-label="Enviar"
            className="bg-slate-100 dark:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-all disabled:opacity-50 flex-shrink-0 p-2 compact:p-1.5"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
