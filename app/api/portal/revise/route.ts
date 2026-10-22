import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL } from "@/app/lib/anthropic";
import { buildPortalRevisePrompt, type PortalReviseTurn } from "@/app/lib/prompts";
import { logger } from "@/app/lib/logger";
import {
  CONTENT_KEYS,
  CONTENT_KEY_LABELS,
  parsePortalContent,
  portalReviseJsonSchema,
  type ContentKey,
} from "@/app/lib/portal/schema";
import { alignMedicationNotes } from "@/app/lib/portal/payload";
import {
  assemblePayload,
  contentIssues,
  deriveParts,
  expiryFrom,
  loadPublishContext,
  PortalPublishError,
  portalPromptInput,
  restrictToKnownMarkers,
} from "@/app/lib/portal/assemble";

export const runtime = "nodejs";
export const maxDuration = 300;

const TOOL_NAME = "revisar_versao_paciente";
const MAX_INSTRUCTION = 2000;

const isContentKey = (v: unknown): v is ContentKey => typeof v === "string" && (CONTENT_KEYS as readonly string[]).includes(v);

function cleanHistory(raw: unknown): PortalReviseTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-8)
    .flatMap((t) => {
      const turn = t as { role?: unknown; text?: unknown };
      if ((turn.role !== "medico" && turn.role !== "ia") || typeof turn.text !== "string" || !turn.text.trim()) return [];
      return [{ role: turn.role, text: turn.text.trim().slice(0, 600) } as PortalReviseTurn];
    });
}

/** Copilot for the patient version: applies one doctor request and returns the revised content. */
export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      patientId?: unknown;
      consultaId?: unknown;
      content?: unknown;
      instruction?: unknown;
      scope?: unknown;
      history?: unknown;
    };
    if (typeof body.patientId !== "string" || typeof body.consultaId !== "string") {
      return NextResponse.json({ error: "patientId e consultaId são obrigatórios." }, { status: 400 });
    }
    const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, MAX_INSTRUCTION) : "";
    if (!instruction) return NextResponse.json({ error: "Escreva o que deseja alterar." }, { status: 400 });

    const current = parsePortalContent(body.content);
    if (!current.success) {
      return NextResponse.json({ error: "O conteúdo atual está incompleto. Corrija os campos marcados antes de pedir à IA." }, { status: 422 });
    }
    const scope = Array.isArray(body.scope) ? body.scope.filter(isContentKey) : [];

    const context = await loadPublishContext(body.patientId, body.consultaId);
    const parts = deriveParts(context.consulta);

    const prompt = buildPortalRevisePrompt({
      sources: portalPromptInput(context, parts),
      content: current.data,
      instruction,
      scopeLabels: scope.map((k) => CONTENT_KEY_LABELS[k]),
      history: cleanHistory(body.history),
    });

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 8192,
        temperature: 0.3,
        // Rules and consulta sources are stable across a revision session; cache both
        system: [
          { type: "text", text: prompt.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: prompt.sources, cache_control: { type: "ephemeral" } },
        ],
        tools: [
          {
            name: TOOL_NAME,
            description: "Registra a alteração pedida pelo médico na versão do paciente, ou uma pergunta quando o pedido não está claro.",
            input_schema: portalReviseJsonSchema() as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME, disable_parallel_tool_use: true },
        messages: [{ role: "user", content: prompt.user }],
      },
      { signal: req.signal }
    );
    const message = await stream.finalMessage();
    if (message.stop_reason === "max_tokens") {
      throw new PortalPublishError("A resposta da IA ficou longa demais e foi cortada. Tente um pedido mais específico.", 422);
    }

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const out = (toolUse?.input ?? {}) as { pergunta?: unknown; resumoDaAlteracao?: unknown; alteracoes?: unknown };
    const summary = typeof out.resumoDaAlteracao === "string" ? out.resumoDaAlteracao.trim() : "";
    const question = typeof out.pergunta === "string" ? out.pergunta.trim() : "";

    // Only top-level sections the model returned, and only those inside the requested scope
    const raw = out.alteracoes && typeof out.alteracoes === "object" ? (out.alteracoes as Record<string, unknown>) : {};
    const changedKeys = CONTENT_KEYS.filter((k) => k in raw && (scope.length === 0 || scope.includes(k)));

    if (changedKeys.length === 0) {
      return NextResponse.json({ question: question || summary || "Não entendi o que alterar. Pode detalhar?" }, { headers: { "Cache-Control": "no-store" } });
    }

    const merged: Record<string, unknown> = { ...current.data };
    for (const k of changedKeys) merged[k] = raw[k];
    const parsed = parsePortalContent(merged);
    if (!parsed.success) {
      logger.warn("Portal revision failed schema validation", { issues: parsed.error.issues.slice(0, 5) });
      throw new PortalPublishError("A IA devolveu um formato inesperado. Tente de novo ou reformule o pedido.", 422);
    }

    let next = restrictToKnownMarkers(parsed.data, context.labSeries);
    const now = new Date();
    const payload = assemblePayload({ context, parts, content: next, publishedAt: now.toISOString(), expiresAt: expiryFrom(now), edited: true });
    next = alignMedicationNotes(next, payload.medicamentos);

    // The copilot may not introduce new blocking problems (e.g. a dose the receita doesn't have)
    const before = new Set(contentIssues(current.data, parts, context.sex));
    const introduced = contentIssues(next, parts, context.sex).filter((i) => !before.has(i));
    if (introduced.length) {
      throw new PortalPublishError(`A sugestão da IA foi descartada: ${introduced.join(" ")}`, 422);
    }

    // Report only sections whose content actually changed
    const changed = changedKeys.filter((k) => JSON.stringify(next[k]) !== JSON.stringify(current.data[k]));

    return NextResponse.json(
      { content: next, changed, summary: summary || "Alteração aplicada.", question: question || undefined },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof PortalPublishError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `IA indisponível (${err.status}): ${err.message}` }, { status: 502 });
    }
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Pedido cancelado." }, { status: 499 });
    }
    logger.error("Portal revise failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao aplicar a alteração." }, { status: 500 });
  }
}
