import { NextResponse } from "next/server";
import pdf from "pdf-parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. IF IT IS A PDF (Try to extract text)
    if (file.type === "application/pdf") {
      try {
        const data = await pdf(buffer);
        if (data.text && data.text.length > 50) {
          return NextResponse.json({ text: data.text });
        }
        return NextResponse.json({ 
          text: "[ERRO: PDF ESCANEADO] Este PDF parece ser uma imagem. Por favor, tire uma foto do exame (JPG ou PNG) e faça o upload da imagem." 
        });
      } catch (e) {
        console.error("PDF Parse Failed:", e);
        return NextResponse.json({ error: "Failed to parse PDF text" }, { status: 500 });
      }
    }

    // 2. IF IT IS AN IMAGE (JPG/PNG) -> USE CLAUDE VISION (HAIKU)
    if (file.type.startsWith("image/")) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

      const base64Image = buffer.toString("base64");
      const mediaType = file.type as "image/jpeg" | "image/png";

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // BACK TO HAIKU VISION
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: "text",
                  text: "Transcreva TODOS os dados numéricos e texto visível nesta imagem médica para formato de texto simples. Se for um gráfico, descreva os valores aproximados.",
                },
              ],
            },
          ],
        }),
      });

      const data = await resp.json();
      
      if (data.error) {
         console.error("Claude Vision Error:", data.error);
         return NextResponse.json({ error: "Erro na leitura da imagem (IA)" }, { status: 500 });
      }

      const extractedText = data.content[0].text;
      return NextResponse.json({ text: extractedText });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  } catch (error: any) {
    console.error("Import Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}