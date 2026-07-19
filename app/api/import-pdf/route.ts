import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size — Vercel rejects bodies over ~4.5MB at the platform level
    const MAX_SIZE = 4 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 4MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    // 1. IF IT IS A PDF
    if (file.type === "application/pdf") {
      try {
        // STEP A: Try standard text extraction first
        let text = "";
        try {
            const data = await pdf(buffer);
            text = data.text;
        } catch (e) {
            logger.info("PDF parse failed, switching to Vision", { error: String(e) });
        }
        
        // If we found significant text, return it (Fast Path)
        if (text && text.length > 150) {
          return NextResponse.json({ text: text });
        }

        // STEP B: "Rescue Mode" - Send PDF to Claude Sonnet 4.5
        logger.info("Scanned/Empty PDF detected, sending to Claude Vision");
        
        const base64Pdf = buffer.toString("base64");

        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            // No beta header needed for 4.5
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data: base64Pdf,
                    },
                  },
                  {
                    type: "text",
                    text: "Extract ALL numerical data, tables, and text from this medical exam. Return plain text only. Do not summarize, just transcribe.",
                  },
                ],
              },
            ],
          }),
        });

        const aiData = await resp.json();

        if (aiData.error) {
          logger.error("AI API Error during PDF import", { error: aiData.error });
          return NextResponse.json({
            error: `AI Error: ${aiData.error.message}`
          }, { status: 500 });
        }

        // Sonnet 5 may prepend a thinking block; find the text block explicitly
        const pdfText = aiData.content?.find((b: { type: string }) => b.type === "text")?.text;
        if (!pdfText) {
          logger.error("Unexpected AI response structure", { response: JSON.stringify(aiData).slice(0, 500) });
          return NextResponse.json({
            error: "Resposta inesperada da IA. Tente novamente."
          }, { status: 500 });
        }

        return NextResponse.json({ text: pdfText });

      } catch (e: any) {
        logger.error("PDF processing failed", { error: e.message });
        return NextResponse.json({ error: "Server Error processing PDF: " + e.message }, { status: 500 });
      }
    }

    // 2. IF IT IS AN IMAGE (JPG/PNG)
    if (file.type.startsWith("image/")) {
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
          model: "claude-sonnet-5",
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
                  text: "Transcreva TODOS os dados numéricos e texto visível nesta imagem médica.",
                },
              ],
            },
          ],
        }),
      });

      const data = await resp.json();

      if (data.error) {
        return NextResponse.json({ error: "AI Error: " + data.error.message }, { status: 500 });
      }

      // Sonnet 5 may prepend a thinking block; find the text block explicitly
      const imageText = data.content?.find((b: { type: string }) => b.type === "text")?.text;
      if (!imageText) {
        logger.error("Unexpected AI response for image", { response: JSON.stringify(data).slice(0, 500) });
        return NextResponse.json({
          error: "Resposta inesperada da IA. Tente novamente."
        }, { status: 500 });
      }

      return NextResponse.json({ text: imageText });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  } catch (error: any) {
    logger.error("Critical import error", { error: error.message });
    return NextResponse.json({ error: "Critical Server Error: " + error.message }, { status: 500 });
  }
}