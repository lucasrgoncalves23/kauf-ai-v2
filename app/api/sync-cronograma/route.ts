import Anthropic from "@anthropic-ai/sdk";
import { buildCronogramaSyncPrompt } from "@/app/lib/prompts";
import { CRONOGRAMA_HEADING } from "@/app/lib/cronogramaSync";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, cachedSystem, messageText } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Doctor-triggered "Regenerar Cronograma" action: regenerates only the
 * CRONOGRAMA DIÁRIO section of the receita from its current item list,
 * leaving the rest of the (possibly hand-edited) document untouched. Uses
 * the main production model — this has no downstream review step before
 * the result is merged and autosaved, unlike the condense-exam pass.
 */
export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return Response.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const { itemsText, currentCronograma } = await req.json();

    if (!itemsText || typeof itemsText !== "string") {
      return Response.json({ error: "Itens não fornecidos" }, { status: 400 });
    }
    if (typeof currentCronograma !== "string") {
      return Response.json({ error: "Cronograma atual não fornecido" }, { status: 400 });
    }

    const { system, user } = buildCronogramaSyncPrompt(itemsText, currentCronograma);

    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.3,
        system: cachedSystem(system),
        messages: [{ role: "user", content: user }],
      },
      { signal: req.signal }
    );

    if (message.stop_reason === "max_tokens") {
      return Response.json({ error: "Resposta excederia o limite" }, { status: 422 });
    }

    const text = messageText(message);
    if (!text.trim() || !text.includes(CRONOGRAMA_HEADING)) {
      return Response.json({ error: "Resposta em formato inesperado" }, { status: 502 });
    }

    return Response.json({ text });
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
