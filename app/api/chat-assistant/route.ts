import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildChatSystemPrompt } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, cachedSystem } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: "API Key missing" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { messages, context } = body;

    const { rules, context: dynamicContext } = buildChatSystemPrompt(context);

    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 4096,
        system: cachedSystem(rules, dynamicContext),
        messages: messages,
      },
      { signal: req.signal }
    );

    return NextResponse.json(message);
  } catch (error: any) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `IA indisponível (${error.status}): ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
