import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { cachedSystem, getAnthropicClient, MODEL } from "@/app/lib/anthropic";
import { buildPortalContentPrompt } from "@/app/lib/prompts";
import { logger } from "@/app/lib/logger";
import { parsePortalContent, portalContentJsonSchema } from "@/app/lib/portal/schema";
import { alignMedicationNotes } from "@/app/lib/portal/payload";
import { signingPinRequired } from "@/app/lib/portal/signature";
import {
  assemblePayload,
  checkRules,
  deriveParts,
  expiryFrom,
  loadPublishContext,
  PortalPublishError,
  portalPromptInput,
  validateContent,
} from "@/app/lib/portal/assemble";

export const runtime = "nodejs";
export const maxDuration = 300;

const TOOL_NAME = "publicar_plano_paciente";

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

  try {
    const body = (await req.json().catch(() => ({}))) as { patientId?: unknown; consultaId?: unknown };
    if (typeof body.patientId !== "string" || typeof body.consultaId !== "string") {
      return NextResponse.json({ error: "patientId e consultaId são obrigatórios." }, { status: 400 });
    }

    const context = await loadPublishContext(body.patientId, body.consultaId);
    const parts = deriveParts(context.consulta);

    const sourceViolations = checkRules(parts, null, context.sex);
    if (sourceViolations.length) {
      throw new PortalPublishError(`Bloqueado pelas regras clínicas: ${sourceViolations.join(", ")}.`, 422);
    }

    const { system, user } = buildPortalContentPrompt(portalPromptInput(context, parts));

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 8192,
        temperature: 0.3,
        system: cachedSystem(system),
        tools: [
          {
            name: TOOL_NAME,
            description: "Registra a versão do paciente da consulta, já traduzida para linguagem simples.",
            input_schema: portalContentJsonSchema() as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME, disable_parallel_tool_use: true },
        messages: [{ role: "user", content: user }],
      },
      { signal: req.signal }
    );
    const message = await stream.finalMessage();

    if (message.stop_reason === "max_tokens") {
      throw new PortalPublishError("A versão do paciente ficou longa demais e foi cortada. Gere novamente.", 422);
    }
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const parsed = parsePortalContent(toolUse?.input);
    if (!parsed.success) {
      logger.warn("Portal content failed schema validation", { issues: parsed.error.issues.slice(0, 5) });
      throw new PortalPublishError("A IA devolveu um formato inesperado. Gere novamente.", 422);
    }

    const content = validateContent(parsed.data, parts, context.labSeries, context.sex);

    const now = new Date();
    const payload = assemblePayload({
      context,
      parts,
      content,
      publishedAt: now.toISOString(),
      expiresAt: expiryFrom(now),
    });

    return NextResponse.json(
      { content: alignMedicationNotes(content, payload.medicamentos), payload, signingPinRequired: signingPinRequired() },
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
      return NextResponse.json({ error: "Geração cancelada." }, { status: 499 });
    }
    logger.error("Portal preview failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao gerar a versão do paciente." }, { status: 500 });
  }
}
