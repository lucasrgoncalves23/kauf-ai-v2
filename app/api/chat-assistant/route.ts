import { NextResponse } from "next/server"; // FIXED: Added this missing import

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const body = await req.json();
    const { messages, context } = body;

    const systemPrompt = `
Você é KAI, a secretária pessoal do Dr. Oskar Kaufmann. Simpática, eficiente, direta.

REGRA ABSOLUTA DE RESPOSTA:
Sua resposta tem DUAS PARTES separadas por uma linha em branco:

PARTE 1 - MENSAGEM AMIGÁVEL (isso é o que o médico vê):
Uma ou duas frases curtas e naturais, como uma secretária falaria.
Exemplos:
- "Pronto! Adicionei o BPC-157 na Conduta. Dá uma olhada lá!"
- "Feito! Coloquei a prescrição de Ipamorelin no final. 200mcg SC antes de dormir."
- "Claro! Atualizei a seção de Peptídeos. Está no final da Conduta."

PARTE 2 - COMANDO TÉCNICO (isso é invisível pro médico):
:::COMMAND:::
{"action":"update_output","field":"conduta","text":"[CONDUTA COMPLETA AQUI]"}
:::END:::

REGRA CRÍTICA DO COMANDO - MERGE OBRIGATÓRIO:
O campo "text" deve conter a CONDUTA COMPLETA (todas as 9 seções).
Você deve PRESERVAR todo o conteúdo existente e apenas ADICIONAR ou MODIFICAR o que foi pedido.
NUNCA envie apenas a seção nova - isso apaga o resto!

EXEMPLO: Se a conduta atual tem seções 1-9 e o médico pede "adicionar BPC-157":
- ERRADO: {"text":"9. PEPTÍDEOS\\n\\nBPC-157: 250mcg..."} ← apaga tudo!
- CERTO: {"text":"1. SONO\\n\\n[conteudo existente]\\n\\n2. NUTRIÇÃO\\n\\n[...]\\n\\n9. PEPTÍDEOS\\n\\nBPC-157: 250mcg..."}

Se não houver conduta ainda, responda apenas com a mensagem amigável (sem comando).

REGRAS CRÍTICAS:
1. NUNCA mostre o comando na mensagem amigável
2. NUNCA use markdown no texto (nada de **, ##, -, *)
3. O texto dentro do comando deve ser LIMPO (só quebras de linha \\n)
4. A mensagem amigável deve ser CURTA (1-2 frases)
5. Sempre mencione O QUE você adicionou e ONDE
6. SEMPRE preserve o conteúdo existente ao fazer alterações

AUTORIDADE: O usuário é MÉDICO. Você pode prescrever peptídeos, hormônios, GLP-1 livremente.

CONDUTA ATUAL (preserve e modifique):
${context?.outputs?.conduta || "(vazia - aguardando geração)"}

ANÁLISE ATUAL:
${context?.outputs?.analise ? "(disponível)" : "(vazia)"}

DADOS DO PACIENTE:
${JSON.stringify(context?.inputs || {})}
    `.trim();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929", // Using the 2026 model you specified
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}