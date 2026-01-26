import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RewriteRequest = {
  patient: Record<string, any>;
  decision: Record<string, any>;
  report: Record<string, any>;
};

// ---------- HELPER: TAG PARSER (SAFETY NET) ----------
function extractSection(text: string, tagName: string): string {
  if (!text) return "";
  
  const startTag = `:::${tagName}_START:::`;
  const endTag = `:::${tagName}_END:::`;
  
  const startIndex = text.indexOf(startTag);
  if (startIndex === -1) return ""; 
  
  const contentStart = startIndex + startTag.length;
  const endIndex = text.indexOf(endTag, contentStart);
  
  // If AI gets cut off (no end tag), return everything it wrote.
  if (endIndex === -1) {
    return text.substring(contentStart).trim();
  }
  
  return text.substring(contentStart, endIndex).trim();
}

// ---------- ROUTE ----------

export async function POST(req: Request) {
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

    // --- PROMPT: AGGRESSIVE LENGTH & DEPTH ---
    const prompt = `
ATUE COMO: Dr. Oskar Kaufmann, Estrategista Clínico de Elite.

SUA MISSÃO:
Gerar um "Relatório de Inteligência Clínica" de altíssima profundidade. O tom deve ser técnico, autoritário e educativo.

---

SEÇÃO 1: ANÁLISE CLÍNICA INTEGRADA (EXTENSA E DETALHADA)
*Instrução de Tamanho:* Esta seção deve ter NO MÍNIMO 800-1000 palavras.
Para CADA um dos 4 pilares (Anamnese, Bioimpedância, Genética, Wearables), você deve escrever 3 a 4 PARÁGRAFOS LONGOS.

REGRAS DE ESCRITA:
1. NÃO RESUMA. Explique a fisiologia por trás de cada dado.
2. Se o paciente tem MTHFR, não diga apenas "tome metilfolato". Explique o ciclo da homocisteína e o impacto na neuroquímica.
3. Se o paciente tem gordura visceral, explique a cascata inflamatória (IL-6, TNF-alfa) e o bloqueio do receptor de insulina.
4. Use prosa narrativa fluida (texto corrido). NÃO use bullet points nesta seção.
5. Conecte os pontos: "A baixa testosterona vista no exame X é explicada pela privação de sono vista no Wearable Y..."

---

SEÇÃO 2: CONDUTA TERAPÊUTICA (PROTOCOLOS PRÁTICOS)
Estruture EXATAMENTE com estes 9 cabeçalhos (Use Markdown ##):

1. SONO
(Higiene do sono, suplementos como Magnésio/Inositol, ajustes de rotina)

2. NUTRIÇÃO
(Estratégia macro/micro, jejum intermitente se cabível, dieta anti-inflamatória)

3. EXERCÍCIO
(Tipo de treino ideal: Hipertrofia, HIIT ou Cardio leve baseado no perfil genético/físico)

4. SUPLEMENTAÇÃO
(Suplementos orais básicos: Creatina, Ômega-3, Multivitamínico, etc.)

5. MANIPULADOS
(Fórmulas personalizadas com doses exatas. Ex: "Fórmula Mitocondrial: CoQ10 100mg + PQQ 10mg...")

6. SOROTERAPIA
(Sugestão de "Drips" endovenosos para recuperação ou ativação metabólica)

7. METABOLISMO / GLP-1
(Uso de análogos de GLP-1 ou sensibilizadores como Metformina/Berberina se indicado)

8. HORMONAL
(TRT, Gestrinona, Progesterona - Apenas se houver indicação clara nos exames)

9. PEPTÍDEOS
(BPC-157 para lesões, Ipamorelin para GH, etc - se indicado)

---

FORMATO DE RESPOSTA (OBRIGATÓRIO):
Use estas tags exatas para que o sistema reconheça o texto:

:::ANALISE_START:::
(Texto da análise longa aqui...)
:::ANALISE_END:::

:::CONDUTA_START:::
(Texto da conduta formatada aqui...)
:::CONDUTA_END:::

---

DADOS DO PACIENTE:
${JSON.stringify(body.patient ?? {}, null, 2)}
`.trim();

    const controller = new AbortController();
    // 2 minutes timeout to allow for long generation
    const timer = setTimeout(() => controller.abort(), 120000);

    let respText = "";

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
          model: "claude-3-haiku-20240307", // BACK TO HAIKU
          max_tokens: 4096, 
          temperature: 0.2, 
          messages: [{ role: "user", content: prompt }],
        }),
      });

      respText = await resp.text();

      if (!resp.ok) {
        console.error("❌ REAL ANTHROPIC ERROR:", respText);
        return NextResponse.json({ ok: false, error: "Anthropic API Error", details: respText.slice(0, 500) }, { status: 502 });
      }
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: "Connection Error", details: e.message }, { status: 502 });
    } finally {
      clearTimeout(timer);
    }

    let data: any;
    try {
      data = JSON.parse(respText);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON from AI Provider" }, { status: 502 });
    }

    const rawText = data.content?.[0]?.text || "";
    
    // --- PARSE TAGS ---
    const analise = extractSection(rawText, "ANALISE");
    const conduta = extractSection(rawText, "CONDUTA");

    if (!analise && !conduta) {
      return NextResponse.json({ 
          ok: false, 
          error: "AI failed to generate report sections", 
          details: rawText.slice(0, 200) 
      }, { status: 422 });
    }

    return NextResponse.json({ 
        ok: true, 
        requestId, 
        filled: {
            analise: analise || "Erro ao gerar Análise.",
            conduta: conduta || "Erro ao gerar Conduta (Texto interrompido)."
        } 
    });

  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}