import { NextResponse } from "next/server";
import { buildRewritePrompt } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";

export const runtime = "nodejs";

type RewriteRequest = {
  patient: Record<string, any>;
  decision: Record<string, any>;
  report: Record<string, any>;
};

// ---------- HELPER: TAG PARSER ----------
function extractSection(text: string, tagName: string): string {
  if (!text) return "";
  const startTag = `:::${tagName}_START:::`;
  const endTag = `:::${tagName}_END:::`;
  const startIndex = text.indexOf(startTag);
  if (startIndex === -1) return "";
  const contentStart = startIndex + startTag.length;
  const endIndex = text.indexOf(endTag, contentStart);
  return endIndex === -1 ? text.substring(contentStart).trim() : text.substring(contentStart, endIndex).trim();
}

// ---------- ROUTE ----------

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const requestId = `rw_${Date.now()}`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ ok: false, error: "Missing API Key" }, { status: 400 });
    }

    let body: RewriteRequest;
    try {
      body = (await req.json()) as RewriteRequest;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const prompt = buildRewritePrompt(body.patient);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 240000);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 16384,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const respText = await resp.text();
    clearTimeout(timer);

    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: "AI Error", details: respText.slice(0, 500) }, { status: 502 });
    }

    const data = JSON.parse(respText);
    // Sonnet 5 may prepend a thinking block; find the text block explicitly
    const rawText = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";

    return NextResponse.json({
        ok: true,
        requestId,
        filled: {
            analise: extractSection(rawText, "ANALISE") || "Erro ao gerar Análise densa.",
            conduta: extractSection(rawText, "CONDUTA") || "Erro ao gerar Conduta formatada."
        }
    });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
