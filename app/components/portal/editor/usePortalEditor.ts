"use client";

import { useCallback, useRef, useState } from "react";
import type { ContentKey, PortalContent } from "../../../lib/portal/schema";

const MAX_HISTORY = 60;
// Keystrokes closer together than this collapse into one undo step
const TYPING_COALESCE_MS = 1200;

export type AiChange = { keys: ContentKey[]; summary: string; before: PortalContent };

export type PortalEditorApi = {
  content: PortalContent;
  original: PortalContent;
  /** `type` edits coalesce into a single undo step; `structure` (add/remove/toggle) always gets its own */
  update: (next: PortalContent, kind?: "type" | "structure") => void;
  undo: () => void;
  canUndo: boolean;
  dirty: boolean;
  aiChange: AiChange | null;
  applyAi: (next: PortalContent, keys: ContentKey[], summary: string) => void;
  revertAi: () => void;
  keepAi: () => void;
  reset: (content: PortalContent) => void;
};

export function usePortalEditor(initial: PortalContent): PortalEditorApi {
  const [content, setContent] = useState(initial);
  const [original, setOriginal] = useState(initial);
  const [history, setHistory] = useState<PortalContent[]>([]);
  const [aiChange, setAiChange] = useState<AiChange | null>(null);
  const lastTyping = useRef(0);

  const push = useCallback((prev: PortalContent) => setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]), []);

  const update = useCallback(
    (next: PortalContent, kind: "type" | "structure" = "type") => {
      const now = Date.now();
      if (kind === "structure" || now - lastTyping.current > TYPING_COALESCE_MS) push(content);
      lastTyping.current = kind === "type" ? now : 0;
      setContent(next);
    },
    [content, push]
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    setContent(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    lastTyping.current = 0;
    setAiChange(null);
  }, [history]);

  const applyAi = useCallback(
    (next: PortalContent, keys: ContentKey[], summary: string) => {
      push(content);
      lastTyping.current = 0;
      setAiChange({ keys, summary, before: content });
      setContent(next);
    },
    [content, push]
  );

  const revertAi = useCallback(() => {
    if (!aiChange) return;
    push(content);
    setContent(aiChange.before);
    setAiChange(null);
  }, [aiChange, content, push]);

  const keepAi = useCallback(() => setAiChange(null), []);

  const reset = useCallback((next: PortalContent) => {
    setContent(next);
    setOriginal(next);
    setHistory([]);
    setAiChange(null);
    lastTyping.current = 0;
  }, []);

  return {
    content,
    original,
    update,
    undo,
    canUndo: history.length > 0,
    dirty: content !== original,
    aiChange,
    applyAi,
    revertAi,
    keepAi,
    reset,
  };
}
