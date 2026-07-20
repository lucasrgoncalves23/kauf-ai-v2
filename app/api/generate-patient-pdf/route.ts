import Anthropic from "@anthropic-ai/sdk";
import { buildPatientPdfPrompt } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, cachedSystem, messageText } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return Response.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const { analise, conduta, patientName } = await req.json();

    if (!analise && !conduta) {
      return Response.json({ error: "Nenhum conteúdo para simplificar" }, { status: 400 });
    }

    const { system, user } = buildPatientPdfPrompt(analise, conduta, patientName);

    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 128000,
        system: cachedSystem(system),
        messages: [{ role: "user", content: user }],
      },
      { signal: req.signal }
    );

    const text = messageText(message);
    if (!text) {
      return Response.json({ error: "Resposta inesperada da IA" }, { status: 500 });
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
