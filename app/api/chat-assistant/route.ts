import { NextResponse } from "next/server";
import { buildChatSystemPrompt } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, cachedSystem, streamToSSE } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: "API Key missing" }, { status: 500 });
  }

  let messages, rules: string, dynamicContext: string | undefined;
  try {
    const body = await req.json();
    messages = body.messages;
    ({ rules, context: dynamicContext } = buildChatSystemPrompt(body.context));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Requisição inválida" },
      { status: 400 }
    );
  }

  // Streamed like the generation routes; API errors surface as SSE error events.
  const stream = client.messages.stream(
    {
      model: MODEL,
      max_tokens: 128000,
      system: cachedSystem(rules, dynamicContext),
      messages,
    },
    { signal: req.signal }
  );

  return streamToSSE(stream);
}
