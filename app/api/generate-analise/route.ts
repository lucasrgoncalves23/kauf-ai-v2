import { buildAnalisePrompt, type Correction, type PhaseContext } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, cachedSystem, streamToSSE } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return Response.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const { patient, corrections, phaseContext } = await req.json();
    const { system, user } = buildAnalisePrompt(
      patient,
      corrections as Correction[],
      phaseContext as PhaseContext | undefined
    );

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 16384,
        system: cachedSystem(system),
        messages: [{ role: "user", content: user }],
      },
      { signal: req.signal }
    );

    return streamToSSE(stream);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
