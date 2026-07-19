import { useState } from "react";
import { logger } from "../lib/logger";
import { getPinHeaders } from "../lib/api-client";
import type {
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
const EDITABLE_FIELDS: (keyof ClinicalOutputs)[] = ["analise", "conduta", "receita"];

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

  async function handleSendMessage() {
    if (!chatInput.trim()) return;
    const newUserMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, newUserMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({
          messages: [...chatMessages, newUserMsg],
          context: { inputs, outputs, engineStatus },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Sonnet 5 may prepend a thinking block; find the text block explicitly
      let rawText =
        data.content?.find((b: { type: string }) => b.type === "text")?.text ||
        "Erro: Resposta vazia do KAUAI.";

      const commandBlocks = [...rawText.matchAll(COMMAND_REGEX)];
      const failures: string[] = [];
      if (commandBlocks.length > 0) {
        // Apply edits against the snapshot the model saw (the `outputs` sent as
        // context), so `find` excerpts match; only touched fields are merged back.
        const working: ClinicalOutputs = { ...outputs };
        const applied = new Set<keyof ClinicalOutputs>();

        for (const block of commandBlocks) {
          try {
            const command = JSON.parse(block[1]);
            const key = command.field as keyof ClinicalOutputs;
            if (!EDITABLE_FIELDS.includes(key)) {
              failures.push(`campo desconhecido: ${command.field}`);
              continue;
            }
            if (command.action === "edit" && typeof command.find === "string") {
              const pos = flexFind(working[key], command.find);
              if (!pos) {
                failures.push(`trecho não encontrado em ${key}`);
                continue;
              }
              working[key] =
                working[key].slice(0, pos.start) +
                (typeof command.replace === "string" ? command.replace : "") +
                working[key].slice(pos.end);
              applied.add(key);
            } else if (command.action === "append" && typeof command.text === "string") {
              working[key] = working[key]
                ? `${working[key].replace(/\s+$/, "")}\n\n${command.text}`
                : command.text;
              applied.add(key);
            } else if (
              (command.action === "set" || command.action === "update_output") &&
              typeof command.text === "string"
            ) {
              working[key] = command.text;
              applied.add(key);
            } else {
              failures.push(`comando inválido em ${key}`);
            }
          } catch (e) {
            logger.error("Failed to parse KAUAI command", { error: String(e) });
            failures.push("comando com JSON inválido");
          }
        }

        if (applied.size > 0) {
          const changes = Object.fromEntries([...applied].map((key) => [key, working[key]]));
          setOutputs((prev) => ({ ...prev, ...changes }));
          setToast({ message: `KAUAI atualizou: ${[...applied].join(", ")}`, type: "success" });
        }
        rawText = rawText.replace(COMMAND_REGEX, "").trim();
      }

      let finalDisplayToken = rawText || "Entendido. Alteração realizada com sucesso!";
      if (failures.length > 0) {
        finalDisplayToken += `\n\n[Atenção: ${failures.length} alteração(ões) não aplicada(s): ${failures.join("; ")}. Pede de novo que eu tento de outro jeito.]`;
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: finalDisplayToken }]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erro: ${err.message || "Falha de conexão"}` },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  return {
    chatInput,
    setChatInput,
    isChatLoading,
    handleSendMessage,
  };
}
