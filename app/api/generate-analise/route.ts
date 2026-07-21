import { buildAnalisePrompt } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, streamToSSE } from "@/app/lib/anthropic";

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
    const { patient } = await req.json();

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 8192,
        temperature: 0.3,
        messages: [{ role: "user", content: buildAnalisePrompt(patient) }],
      },
      { signal: req.signal }
    );

    return streamToSSE(stream);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
