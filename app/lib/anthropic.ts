import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

/**
 * Shared Anthropic client + SSE streaming helper for the AI routes.
 * The SDK gives automatic retries on 429/5xx and typed errors.
 */

// June 2026 production model, restored at the clinic's request — Sonnet 4.5
// has no adaptive thinking, so it starts streaming text immediately and
// accepts temperature (both of which broke with claude-sonnet-5).
export const MODEL = "claude-sonnet-4-5-20250929";

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) return null;
  return new Anthropic({ apiKey: apiKey.trim() });
}

/** Build a cacheable system param: static block (cached) + optional dynamic block. */
export function cachedSystem(
  staticText: string,
  dynamicText?: string
): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [
    { type: "text", text: staticText, cache_control: { type: "ephemeral" } },
  ];
  if (dynamicText) blocks.push({ type: "text", text: dynamicText });
  return blocks;
}

const STOP_REASON_MESSAGES: Record<string, string> = {
  max_tokens:
    "Resposta interrompida por limite de tamanho — o texto pode estar INCOMPLETO. Gere novamente.",
  refusal: "A IA recusou gerar este conteúdo. Revise os dados e tente novamente.",
};

type AnthropicMessageStream = AsyncIterable<Anthropic.Messages.RawMessageStreamEvent> & {
  controller: AbortController;
};

/**
 * Re-encode an SDK message stream as the app's SSE format:
 * `data: {"text": ...}` chunks, `data: {"thinking": ...}` reasoning-summary
 * chunks (shown as a preview while the model thinks), `data: {"error": ...}`
 * on truncation/refusal or failure, always terminated by `data: [DONE]`.
 */
export function streamToSSE(stream: AnthropicMessageStream): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ text: event.delta.text });
          } else if (event.type === "content_block_delta" && event.delta.type === "thinking_delta") {
            send({ thinking: event.delta.thinking });
          } else if (event.type === "message_delta" && event.delta.stop_reason) {
            const warning = STOP_REASON_MESSAGES[event.delta.stop_reason];
            if (warning) send({ error: warning });
          }
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          logger.error("AI stream failed", { error: String(err) });
          send({
            error: err instanceof Error ? err.message : "Erro no processamento da IA",
          });
        }
      } finally {
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      // Client disconnected — stop the upstream API call so it isn't billed further
      stream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** Extract the text block from a non-streaming response (skips thinking blocks). */
export function messageText(message: Anthropic.Messages.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}
