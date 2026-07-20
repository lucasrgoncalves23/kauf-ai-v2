import { useMemo, useRef, useState } from "react";
import { logger } from "../lib/logger";
import { getPinHeaders } from "../lib/api-client";
import { processStream } from "../utils/stream";
import type {
  ChatEdit,
  ChatMessage,
  ClinicalData,
  ClinicalOutputs,
  EngineStatus,
  ToastState,
} from "../types/clinical";

interface CopilotChatOptions {
  inputs: ClinicalData;
  outputs: ClinicalOutputs;
  engineStatus: EngineStatus;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>;
  setToast: (toast: ToastState) => void;
}

const COMMAND_REGEX = /:::COMMAND:::([\s\S]*?):::END:::/g;
const COMMAND_OPEN = ":::COMMAND:::";
const EDITABLE_FIELDS: (keyof ClinicalOutputs)[] = ["analise", "conduta", "receita"];

export const FIELD_LABELS: Record<keyof ClinicalOutputs, string> = {
  analise: "Análise",
  conduta: "Conduta",
  receita: "Receita",
};

// Locate `needle` in `haystack`; falls back to whitespace-flexible matching
// because the model may normalize line breaks when quoting the document.
export function flexFind(haystack: string, needle: string): { start: number; end: number } | null {
  if (!needle.trim()) return null;
  const idx = haystack.indexOf(needle);
  if (idx !== -1) return { start: idx, end: idx + needle.length };
  const pattern = needle
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  if (!pattern) return null;
  const match = haystack.match(new RegExp(pattern));
  if (!match || match.index === undefined) return null;
  return { start: match.index, end: match.index + match[0].length };
}

/**
 * Text safe to show while the reply is still streaming: completed command
 * blocks are stripped, and an unterminated block (or a partial `:::COMMAND:::`
 * marker at the tail) is held back until the stream finishes.
 */
export function visibleStreamText(raw: string): string {
  let text = raw.replace(COMMAND_REGEX, "");
  const open = text.indexOf(COMMAND_OPEN);
  if (open !== -1) {
    text = text.slice(0, open);
  } else {
    for (let k = Math.min(COMMAND_OPEN.length - 1, text.length); k > 0; k--) {
      if (text.endsWith(COMMAND_OPEN.slice(0, k))) {
        text = text.slice(0, text.length - k);
        break;
      }
    }
  }
  return text.trimStart().replace(/\s+$/, "");
}

function excerpt(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export type AppliedCommands = {
  /** Reply text with command blocks removed */
  text: string;
  /** New values for the fields that changed */
  changes: Partial<ClinicalOutputs>;
  /** Display records for the chat edit card */
  edits: ChatEdit[];
  /** Human-readable reasons for commands that could not be applied */
  failures: string[];
};

/**
 * Parse and apply every :::COMMAND::: block in `raw` against `outputs`
 * (the snapshot the model saw, so `find` excerpts match).
 */
function sanitizeJsonNewlines(raw: string): string {
  return raw.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  );
}

export function applyChatCommands(raw: string, outputs: ClinicalOutputs): AppliedCommands {
  const working: ClinicalOutputs = { ...outputs };
  const edits: ChatEdit[] = [];
  const failures: string[] = [];
  const touched = new Set<keyof ClinicalOutputs>();

  for (const block of raw.matchAll(COMMAND_REGEX)) {
    try {
      const command = JSON.parse(sanitizeJsonNewlines(block[1]));
      const key = command.field as keyof ClinicalOutputs;
      if (!EDITABLE_FIELDS.includes(key)) {
        failures.push(`campo desconhecido: ${command.field}`);
        continue;
      }
      if (command.action === "edit" && typeof command.find === "string") {
        const pos = flexFind(working[key], command.find);
        if (!pos) {
          failures.push(`trecho não encontrado em ${FIELD_LABELS[key]}`);
          continue;
        }
        const replace = typeof command.replace === "string" ? command.replace : "";
        const before = working[key].slice(pos.start, pos.end);
        working[key] = working[key].slice(0, pos.start) + replace + working[key].slice(pos.end);
        touched.add(key);
        edits.push({ field: key, action: "edit", before: excerpt(before), after: excerpt(replace) });
      } else if (command.action === "append" && typeof command.text === "string") {
        working[key] = working[key]
          ? `${working[key].replace(/\s+$/, "")}\n\n${command.text}`
          : command.text;
        touched.add(key);
        edits.push({ field: key, action: "append", after: excerpt(command.text) });
      } else if (
        (command.action === "set" || command.action === "update_output") &&
        typeof command.text === "string"
      ) {
        working[key] = command.text;
        touched.add(key);
        edits.push({ field: key, action: "set", after: excerpt(command.text) });
      } else {
        failures.push(`comando inválido em ${FIELD_LABELS[key]}`);
      }
    } catch (e) {
      logger.error("Failed to parse KAUAI command", { error: String(e) });
      failures.push("comando com JSON inválido");
    }
  }

  const changes = Object.fromEntries([...touched].map((key) => [key, working[key]]));
  return { text: raw.replace(COMMAND_REGEX, "").trim(), changes, edits, failures };
}

function buildSuggestions(
  inputs: ClinicalData,
  outputs: ClinicalOutputs,
  engineStatus: EngineStatus
): string[] {
  const suggestions: string[] = [];
  if (engineStatus?.waiting?.length) {
    suggestions.push(`Por que o módulo ${engineStatus.waiting[0].module} está aguardando?`);
  }
  if (engineStatus) {
    suggestions.push(`Por que o paciente está na Fase ${engineStatus.phase}?`);
  }
  if (inputs.laboratoriais.trim()) {
    suggestions.push("Quais marcadores laboratoriais estão fora do ideal?");
  }
  if (outputs.conduta.trim()) {
    suggestions.push("Resuma a conduta em 3 pontos simples.");
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "O que você consegue fazer?",
      "Como interpretar HRV e RHR do wearable?"
    );
  }
  return suggestions.slice(0, 3);
}

export function useCopilotChat({
  inputs,
  outputs,
  engineStatus,
  chatMessages,
  setChatMessages,
  setOutputs,
  setToast,
}: CopilotChatOptions) {
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  // Mirrors the chatMessages prop; if a patient switch replaces the thread
  // mid-stream, the reply's id disappears and the response must be discarded.
  const liveMessagesRef = useRef<ChatMessage[]>(chatMessages);
  liveMessagesRef.current = chatMessages;
  // Full previous values of edited fields, per assistant message — kept out of
  // React state so undo snapshots are never persisted with the patient record.
  const undoSnapshots = useRef(new Map<string, Partial<ClinicalOutputs>>());
  const [undoableIds, setUndoableIds] = useState<string[]>([]);

  const suggestions = useMemo(
    () => buildSuggestions(inputs, outputs, engineStatus),
    [inputs, outputs, engineStatus]
  );

  async function run(history: ChatMessage[]) {
    setIsChatLoading(true);
    const msgId = crypto.randomUUID();
    // History for the API: role/content only, skipping failed placeholder replies
    const apiMessages = history
      .filter((m) => m.content && !m.error)
      .map(({ role, content }) => ({ role, content }));

    setChatMessages((prev) => [...prev, { role: "assistant", content: "", id: msgId }]);
    setStreamingId(msgId);

    let raw = "";
    const patch = (fields: Partial<ChatMessage>) =>
      setChatMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...fields } : m)));

    try {
      const res = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({
          messages: apiMessages,
          context: { inputs, outputs, engineStatus },
        }),
      });
      if (!res.ok) {
        let message = `Erro ${res.status}`;
        try {
          const data = await res.json();
          if (data.error) message = data.error;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(message);
      }

      let streamErr: string | undefined;
      try {
        await processStream(res, (chunk) => {
          raw += chunk;
          patch({ content: visibleStreamText(raw) });
        });
      } catch (err) {
        streamErr = err instanceof Error ? err.message : "Falha de conexão";
      }

      // Patient switched while the reply streamed — never edit the new
      // patient's documents with commands aimed at the previous one.
      if (!liveMessagesRef.current.some((m) => m.id === msgId)) return;

      const { text, changes, edits, failures } = applyChatCommands(raw, outputs);
      const touched = Object.keys(changes) as (keyof ClinicalOutputs)[];
      if (touched.length > 0) {
        undoSnapshots.current.set(
          msgId,
          Object.fromEntries(touched.map((key) => [key, outputs[key]]))
        );
        setUndoableIds((prev) => [...prev, msgId]);
        setOutputs((prev) => ({ ...prev, ...changes }));
        setToast({
          message: `KAUAI atualizou: ${touched.map((key) => FIELD_LABELS[key]).join(", ")}`,
          type: "success",
        });
      }

      if (!touched.length && !streamErr && !raw.includes(COMMAND_OPEN)) {
        const actionWords = /\b(adicionei|alterei|removi|criei|ajustei|tirei|inseri|troquei|montei|atualizei|coloquei)\b/i;
        if (actionWords.test(text)) {
          failures.push("resposta indica alteração mas nenhum comando foi gerado — peça novamente");
        }
      }

      const content =
        text ||
        (edits.length > 0
          ? "Entendido. Alteração realizada com sucesso!"
          : "Erro: Resposta vazia do KAUAI.");
      patch({
        content,
        edits: edits.length > 0 ? edits : undefined,
        failures: failures.length > 0 ? failures : undefined,
        error: streamErr,
      });
    } catch (err) {
      const partial = visibleStreamText(raw);
      patch({
        content: partial,
        error: err instanceof Error ? err.message : "Falha de conexão",
      });
    } finally {
      setStreamingId(null);
      setIsChatLoading(false);
    }
  }

  function handleSendMessage(text?: string) {
    const content = (text ?? chatInput).trim();
    if (!content || isChatLoading) return;
    const userMsg: ChatMessage = { role: "user", content, id: crypto.randomUUID() };
    const history = [...chatMessages, userMsg];
    setChatMessages(history);
    setChatInput("");
    void run(history);
  }

  /** Re-send the conversation up to the last user message (drops the failed reply). */
  function handleRetry() {
    if (isChatLoading) return;
    const lastUser = chatMessages.map((m) => m.role).lastIndexOf("user");
    if (lastUser === -1) return;
    const history = chatMessages.slice(0, lastUser + 1);
    setChatMessages(history);
    void run(history);
  }

  /** Revert the document changes a reply applied (current session only). */
  function handleUndoEdits(messageId: string) {
    const snapshot = undoSnapshots.current.get(messageId);
    if (!snapshot) return;
    setOutputs((prev) => ({ ...prev, ...snapshot }));
    undoSnapshots.current.delete(messageId);
    setUndoableIds((prev) => prev.filter((id) => id !== messageId));
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, undone: true } : m))
    );
    setToast({ message: "Alterações do KAUAI desfeitas", type: "info" });
  }

  return {
    chatInput,
    setChatInput,
    isChatLoading,
    streamingId,
    suggestions,
    undoableIds,
    handleSendMessage,
    handleRetry,
    handleUndoEdits,
  };
}
