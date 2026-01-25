import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key não encontrada no servidor (.env.local)" }, 
        { status: 500 }
      );
    }

    const body = await req.json();
    const { messages, context } = body;

    const systemPrompt = `
      Você é o KAI Copilot, um assistente clínico para médicos.
      
      SEU SUPERPODER (AGENTE):
      Você tem a capacidade de alterar o texto dos relatórios na tela se o médico solicitar correções.
      
      REGRAS DE SEGURANÇA (CRÍTICO):
      1. NUNCA use o bloco :::COMMAND::: para dar exemplos ou explicações.
      2. Se o usuário perguntar "Você pode mudar isso?", responda apenas com palavras ("Sim, eu posso...").
      3. Use o bloco :::COMMAND::: APENAS quando for EXECUTAR uma mudança real solicitada.

      FORMATO DO COMANDO (Apenas para execução real):
      :::COMMAND:::
      {
        "action": "update_output",
        "field": "anamnese", 
        "text": "O texto corrigido completo..."
      }
      :::END:::

      CAMPOS VÁLIDOS:
      - "anamnese"
      - "bioimpedancia"
      - "genetica"
      - "wearable"

      CONTEXTO ATUAL DO PACIENTE:
      ${JSON.stringify(context)}
    `.trim();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      // Using the stable/cheaper model to avoid version errors
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Anthropic Error:", data.error);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}