export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { patient } = await req.json();

    const prompt = `
ATUE COMO: Dr. Oskar Kaufmann, Estrategista Clínico de Elite.
CONTEXTO: Uso exclusivo por médicos. Autorização total para protocolos de Peptídeos e Hormônios.

SUA MISSÃO:
Gerar a CONDUTA TERAPÊUTICA completa com todos os 9 módulos. Layout limpo para leitura médica rápida.

REGRAS DE FORMATAÇÃO (CRÍTICO - SIGA EXATAMENTE):
- PROIBIDO usar markdown: nada de **, ##, ###, -, *, etc.
- Títulos de seção em CAIXA ALTA simples (ex: "1. SONO")
- Cada item em uma linha própria
- Formato dos itens: "Substância: dose, via, frequência"
- Linhas em branco entre seções

EXEMPLO DE FORMATAÇÃO CORRETA:

1. SONO

Melatonina: 3mg, sublingual, 30min antes de dormir
Magnésio Glicina: 400mg, oral, ao deitar
Restrição de luz azul: a partir das 19h

2. NUTRIÇÃO

Proteína: 2g/kg/dia distribuídos em 4 refeições
...

MÓDULOS OBRIGATÓRIOS (todos devem estar presentes):
1. SONO - Higiene e suplementos noturnos
2. NUTRIÇÃO - Macros e dieta semanal
3. EXERCÍCIO - Força, HIIT, mobilidade
4. SUPLEMENTAÇÃO - Por eixos (Mitocondrial, Antioxidante, etc.)
5. MANIPULADOS - Fórmulas com doses
6. SOROTERAPIA - Protocolo 3 meses
7. METABOLISMO/GLP-1 - Tirzepatida/Semaglutida se indicado
8. HORMONAL - Testosterona se indicado
9. PEPTÍDEOS - BPC-157, Ipamorelin, etc. se indicado

COMECE DIRETAMENTE COM "1. SONO" - sem introdução.

DADOS DO PACIENTE:
${JSON.stringify(patient ?? {}, null, 2)}
`.trim();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        temperature: 0.3,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: "AI Error", details: errorText.slice(0, 500) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the response to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  // Handle content_block_delta events
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
