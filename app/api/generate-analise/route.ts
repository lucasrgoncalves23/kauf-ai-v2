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
CONTEXTO: Uso exclusivo por médicos. Autorização total para protocolos.

SUA MISSÃO:
Gerar a ANÁLISE CLÍNICA INTEGRADA (Tese Fisiológica) com profundidade técnica e densidade científica. Tom acadêmico, molecular e autoritário. Mínimo 1000 palavras.

REGRAS DE FORMATAÇÃO (CRÍTICO):
PROIBIDO usar markdown: nada de **, ##, -, *, etc.
Texto narrativo puro em parágrafos densos e conectados.
Sem listas, sem bullets, sem marcadores.
Apenas parágrafos fluidos de prosa técnica.

CONTEÚDO OBRIGATÓRIO:

BIOIMPEDÂNCIA: Conecte gordura visceral à inflamação sistêmica (IL-6, TNF-α) e resistência insulínica. Explique como adipocinas inflamatórias perpetuam o ciclo metabólico.

WEARABLES: Analise privação de sono e instabilidade de HRV como gatilhos para disfunção neuroendócrina. Discorra sobre eixo HPA, cortisol, secreção noturna de GH e testosterona, sensibilidade à leptina/grelina, tônus vagal.

GENÉTICA: Se houver polimorfismos (MTHFR, COMT, APOE, VDR, CYP), explique vias enzimáticas afetadas, impacto na metilação e detoxificação. Se não houver dados, foque no estilo de vida.

LABORATÓRIO: Integre HOMA-IR, HbA1c, perfil lipídico com a tese fisiológica.

CONSTRUA UMA TESE COERENTE que conecte todos os achados em uma narrativa clínica unificada.

COMECE DIRETAMENTE COM O TEXTO CLÍNICO - sem títulos, sem introdução.

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
