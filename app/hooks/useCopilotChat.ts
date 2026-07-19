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

      const commandRegex = /:::COMMAND:::([\s\S]*?):::END:::/;
      const match = rawText.match(commandRegex);
      if (match) {
        const jsonStr = match[1];
        try {
          const command = JSON.parse(jsonStr);
          if (command.action === "update_output" && command.field && command.text) {
            const key = command.field as keyof ClinicalOutputs;
            if (["analise", "conduta"].includes(key)) {
              setOutputs((prev) => ({ ...prev, [key]: command.text }));
              setToast({ message: `KAUAI atualizou: ${key}`, type: "success" });
            }
          }
        } catch (e) {
          logger.error("Failed to execute KAUAI command", { error: String(e) });
        }
        rawText = rawText.replace(commandRegex, "").trim();
      }

      const finalDisplayToken = rawText || "Entendido. Alteração realizada com sucesso!";
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
