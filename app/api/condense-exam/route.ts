import Anthropic from "@anthropic-ai/sdk";
import { buildCondensePrompt } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, EXTRACT_MODEL, cachedSystem, messageText } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 300;

// Protects the model's context window from pathological inputs (~150k tokens).
const MAX_INPUT_CHARS = 600_000;

/**
 * Pre-generation condensation pass: distills a huge pasted/imported exam
 * document into a structured clinical summary so the generation prompts
 * reason over clean data instead of raw OCR text. The client falls back to
 * the raw text on any failure, so this route must never partially succeed:
 * a truncated summary (missing exams) is worse than no summary.
 */
export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return Response.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const { section, text } = await req.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Texto não fornecido" }, { status: 400 });
    }

    const { system, user } = buildCondensePrompt(
      String(section || "documento"),
      text.slice(0, MAX_INPUT_CHARS)
    );

    const message = await client.messages.create(
      {
        model: EXTRACT_MODEL,
        max_tokens: 8192,
        system: cachedSystem(system),
        messages: [{ role: "user", content: user }],
      },
      { signal: req.signal }
    );

    if (message.stop_reason === "max_tokens") {
      // Summary would be incomplete — better to let the client use the raw text.
      return Response.json({ error: "Resumo excederia o limite" }, { status: 422 });
    }

    const condensed = messageText(message);
    if (!condensed.trim()) {
      return Response.json({ error: "Resposta vazia da IA" }, { status: 502 });
    }

    return Response.json({ text: condensed });
  } catch (err: any) {
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: `IA indisponível (${err.status}): ${err.message}` },
        { status: 502 }
      );
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
