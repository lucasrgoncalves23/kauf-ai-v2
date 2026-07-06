"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage, Settings } from "../types/clinical";
import { renderSimpleMarkdown } from "../utils/markdown";

type CopilotChatProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onOpenFullscreen: () => void;
  settings: Settings;
};

export function CopilotChat({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  onOpenFullscreen,
  settings,
}: CopilotChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const compact = settings.ui.compactView;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b border-slate-100/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30 ${
          compact ? "px-3 py-2" : "px-5 py-3"
        }`}
      >
        <span
          className={`font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ${
            compact ? "text-[9px]" : "text-[10px]"
          }`}
        >
          Copiloto KAUAI
        </span>
        <button
          onClick={onOpenFullscreen}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
          title="Tela cheia"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className={`flex-1 overflow-y-auto ${compact ? "p-3 space-y-2" : "p-5 space-y-4"}`}
        ref={scrollRef}
      >
        {messages.length === 0 && (
          <div
            className={`h-full flex flex-col items-center justify-center text-center opacity-40 ${
              compact ? "p-3" : "p-6"
            }`}
          >
            <p className={`text-slate-400 dark:text-slate-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
              &quot;Por que o paciente ta na Fase A?&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-2xl leading-relaxed shadow-sm whitespace-pre-wrap ${
                compact ? "p-2 text-[11px]" : "p-3.5 text-[13px]"
              } font-medium ${
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
          <div className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse ml-2 font-medium">
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className={`border-t border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 ${
          compact ? "p-2" : "p-4"
        }`}
      >
        <div
          className={`flex items-center gap-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 transition-all ${
            compact ? "p-1" : "p-1.5"
          }`}
        >
          <input
            className={`flex-1 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white ${
              compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-xs"
            }`}
            placeholder="Ask KAUAI anything..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <button
            onClick={onSend}
            disabled={isLoading}
            className={`bg-slate-100 dark:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 flex-shrink-0 ${
              compact ? "p-1.5 text-xs" : "p-2"
            }`}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
