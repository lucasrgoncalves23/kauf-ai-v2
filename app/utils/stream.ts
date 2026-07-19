/**
 * Stream Processing Utilities
 *
 * Handles Server-Sent Events (SSE) from streaming API endpoints.
 */

import { logger } from "../lib/logger";

/**
 * Process an SSE stream from a Response object
 *
 * @param response - Fetch Response with streaming body
 * @param onChunk - Callback for each text chunk received
 * @param signal - Optional AbortSignal to cancel the stream
 * @returns The full accumulated text
 */
export async function processStream(
  response: Response,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let streamError: string | null = null;

  // Handle abort signal
  if (signal) {
    signal.addEventListener("abort", () => {
      reader.cancel();
    });
  }

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              onChunk(parsed.text);
            }
            // Server reports truncation/refusal/failure as an error event
            if (parsed.error) {
              streamError = String(parsed.error);
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      // Stream was intentionally cancelled
      return fullText;
    }
    logger.error("Stream processing error", { error: String(err) });
  }

  // Surface after draining so partial text stays visible in the editor
  if (streamError && !signal?.aborted) {
    throw new Error(streamError);
  }

  return fullText;
}
