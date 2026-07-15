import { buildPatientPdfPrompt } from "@/app/lib/prompts";

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

    const { analise, conduta, patientName } = await req.json();

    if (!analise && !conduta) {
      return new Response(JSON.stringify({ error: "Nenhum conteúdo para simplificar" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const prompt = buildPatientPdfPrompt(analise, conduta, patientName);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
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

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sonnet 5 may prepend a thinking block; find the text block explicitly
    const outputText = data.content?.find((b: { type: string }) => b.type === "text")?.text;
    if (!outputText) {
      return new Response(JSON.stringify({ error: "Resposta inesperada da IA" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: outputText }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
