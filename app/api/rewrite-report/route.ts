import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RewriteRequest = {
  patient: Record<string, any>;
  decision: Record<string, any>;
  report: Record<string, any>;
};

// ---------- helpers ----------

function makeRequestId() {
  return `rw_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function trunc(s: string, n = 1200) {
  const t = s ?? "";
  return t.length > n ? t.slice(0, n) + "…(truncated)" : t;
}

/**
 * Finds the first balanced {...} JSON object in a string.
 * Works even with text before/after.
 */
function braceScanForObject(input: string): string | null {
  const str = (input ?? "").trim();
  if (!str) return null;

  const firstBrace = str.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        continue;
      }
      continue;
    } else {
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth === 0) {
        const candidate = str.slice(firstBrace, i + 1).trim();
        return candidate.length ? candidate : null;
      }
    }
  }

  return null;
}

/**
 * If Claude returns "json\n\n" prefix, or returns key/value pairs WITHOUT the opening "{",
 * repair into a proper JSON object string.
 */
function repairAlmostJson(raw: string): { repaired: string; didRepair: boolean } {
  let t = (raw ?? "").trim();
  if (!t) return { repaired: t, didRepair: false };

  // remove leading "json" token sometimes emitted
  t = t.replace(/^\s*json\s*/i, "").trim();

  // If we already have an object, no repair needed
  if (t.includes("{")) return { repaired: t, didRepair: false };

  // If it looks like object fields, wrap it
  // e.g. starts with:  "diagnosticoIntegrativo": "..."
  const looksLikeFields =
    /"\s*diagnosticoIntegrativo\s*"\s*:/.test(t) ||
    /"\s*gargaloPrimario\s*"\s*:/.test(t) ||
    /"\s*programas\s*"\s*:/.test(t);

  if (!looksLikeFields) return { repaired: t, didRepair: false };

  // If it ends with "}" already, it might only be missing the opening "{"
  // Otherwise wrap fully.
  if (t.endsWith("}")) {
    return { repaired: `{${t}`, didRepair: true };
  }

  return { repaired: `{${t}}`, didRepair: true };
}

function extractJsonObjectFromClaudeText(raw: string): { jsonText: string | null; strategy: string } {
  const text0 = (raw ?? "").trim();
  if (!text0) return { jsonText: null, strategy: "empty" };

  // 0) Repair common "json\n\n" prefix + missing "{"
  const { repaired, didRepair } = repairAlmostJson(text0);
  const text = repaired.trim();

  // 1) Strip ```json ... ``` fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const inside = fenced[1].trim();
    const repairedInside = repairAlmostJson(inside).repaired.trim();

    const obj = braceScanForObject(repairedInside);
    if (obj) return { jsonText: obj, strategy: didRepair ? "repair+code_fence+brace_scan" : "code_fence+brace_scan" };

    // If it still doesn't have braces but looks like fields, wrap and return
    const { repaired: wrapped, didRepair: didRepair2 } = repairAlmostJson(repairedInside);
    if (didRepair2) return { jsonText: wrapped, strategy: "code_fence+repair_wrap" };

    return { jsonText: null, strategy: "code_fence_not_object" };
  }

  // 2) Brace scan entire text (handles extra text before/after)
  const obj = braceScanForObject(text);
  if (obj) return { jsonText: obj, strategy: didRepair ? "repair+brace_scan" : "brace_scan" };

  // 3) If still no braces but it looks like fields, wrap and return
  const { repaired: wrapped2, didRepair: didRepair3 } = repairAlmostJson(text0);
  if (didRepair3) return { jsonText: wrapped2, strategy: "repair_wrap" };

  // 4) Nothing found
  return { jsonText: null, strategy: didRepair ? "repair_but_not_found" : "not_found" };
}

// ---------- route ----------

export async function POST(req: Request) {
  const requestId = makeRequestId();

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: "Missing ANTHROPIC_API_KEY in .env.local (project root). Restart dev server.",
        },
        { status: 400 }
      );
    }

    let body: RewriteRequest;
    try {
      body = (await req.json()) as RewriteRequest;
    } catch {
      return NextResponse.json(
        { ok: false, requestId, error: "Invalid JSON body sent to /api/rewrite-report." },
        { status: 400 }
      );
    }

    const prompt = `
Você é um médico urologista integrativo (Brasil).
Sua tarefa é PREENCHER o relatório do Kauf AI com texto clínico claro e objetivo.

REGRAS IMPORTANTES:
- NÃO altere a fase, alertas ou bloqueios do engine. Apenas escreva o relatório.
- Seja conservador. Não prescreva doses. Não invente exames.
- Use português (Brasil).
- Retorne APENAS UM OBJETO JSON VÁLIDO.
- O JSON DEVE COMEÇAR COM { E TERMINAR COM }.
- SEM markdown, SEM texto antes/depois, SEM blocos de código.
- Seja conciso: 2–5 frases por campo. Programas: bullets curtos.

FORMATO DE SAÍDA (JSON):
{
  "diagnosticoIntegrativo": "string",
  "gargaloPrimario": "string",
  "camadasAtivas": "string",
  "programas": {
    "Sono": "string",
    "Nutrição": "string",
    "Exercício": "string",
    "Suplementação": "string",
    "Manipulados": "string",
    "Soroterapia": "string",
    "Metabolismo / GLP-1": "string",
    "Hormonal": "string",
    "Peptídeos": "string"
  },
  "kpis": "string"
}

DADOS DO PACIENTE:
${JSON.stringify(body.patient ?? {}, null, 2)}

DECISÃO DO ENGINE (NÃO MUDAR):
${JSON.stringify(body.decision ?? {}, null, 2)}

TEMPLATE ATUAL DO REPORT:
${JSON.stringify(body.report ?? {}, null, 2)}
`.trim();

    // ---- timeout so we never hang ----
    const timeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS ?? 60000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let respText = "";
    let upstreamStatus = 0;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2000,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      upstreamStatus = resp.status;
      respText = await resp.text();

      if (!resp.ok) {
        return NextResponse.json(
          {
            ok: false,
            requestId,
            error: "Anthropic HTTP error",
            upstreamStatus,
            upstreamBody: trunc(respText),
          },
          { status: 502 }
        );
      }
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: aborted ? `Claude timed out after ${timeoutMs}ms.` : "Failed calling Anthropic.",
          details: aborted ? undefined : (e?.message ?? String(e)),
        },
        { status: aborted ? 504 : 502 }
      );
    } finally {
      clearTimeout(timer);
    }

    // Parse Anthropic wrapper JSON
    let data: any;
    try {
      data = JSON.parse(respText);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: "Anthropic returned non-JSON body.",
          upstreamStatus,
          upstreamBody: trunc(respText),
        },
        { status: 502 }
      );
    }

    const rawText =
      data?.content?.[0]?.text ??
      data?.content?.map?.((c: any) => c?.text).filter(Boolean).join("\n") ??
      "";

    if (!rawText.trim()) {
      return NextResponse.json(
        { ok: false, requestId, error: "Claude returned empty text." },
        { status: 502 }
      );
    }

    // Extract JSON (handles fences + extra text + "json" prefix + missing "{")
    const { jsonText, strategy } = extractJsonObjectFromClaudeText(rawText);

    if (!jsonText) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: "Claude output did not contain JSON object.",
          strategy,
          rawPreview: trunc(rawText),
        },
        { status: 422 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: "Failed to parse Claude JSON.",
          strategy,
          parseError: err?.message ?? String(err),
          rawPreview: trunc(rawText),
          extractedPreview: trunc(jsonText),
        },
        { status: 422 }
      );
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: "Claude JSON parsed but is not an object.",
          strategy,
          parsedType: Array.isArray(parsed) ? "array" : typeof parsed,
          rawPreview: trunc(rawText),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, requestId, filled: parsed });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, requestId, error: "rewrite-report failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
