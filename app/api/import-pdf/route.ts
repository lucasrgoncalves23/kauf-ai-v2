import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, messageText } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const client = getAnthropicClient();

    if (!client) {
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

        // STEP B: "Rescue Mode" - send the PDF to Claude Vision
        logger.info("Scanned/Empty PDF detected, sending to Claude Vision");

        const message = await client.messages.create({
          model: MODEL,
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
                    data: buffer.toString("base64"),
                  },
                },
                {
                  type: "text",
                  text: "Extract ALL numerical data, tables, and text from this medical exam. Return plain text only. Do not summarize, just transcribe.",
                },
              ],
            },
          ],
        });

        const pdfText = messageText(message);
        if (!pdfText) {
          logger.error("Unexpected AI response structure for PDF");
          return NextResponse.json(
            { error: "Resposta inesperada da IA. Tente novamente." },
            { status: 500 }
          );
        }

        return NextResponse.json({ text: pdfText });
      } catch (e: any) {
        logger.error("PDF processing failed", { error: e.message });
        return NextResponse.json(
          { error: "Server Error processing PDF: " + e.message },
          { status: 500 }
        );
      }
    }

    // 2. IF IT IS AN IMAGE (JPG/PNG)
    if (file.type.startsWith("image/")) {
      const mediaType = file.type as "image/jpeg" | "image/png";

      const message = await client.messages.create({
        model: MODEL,
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
                  data: buffer.toString("base64"),
                },
              },
              {
                type: "text",
                text: "Transcreva TODOS os dados numéricos e texto visível nesta imagem médica.",
              },
            ],
          },
        ],
      });

      const imageText = messageText(message);
      if (!imageText) {
        logger.error("Unexpected AI response for image");
        return NextResponse.json(
          { error: "Resposta inesperada da IA. Tente novamente." },
          { status: 500 }
        );
      }

      return NextResponse.json({ text: imageText });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `IA indisponível (${error.status}): ${error.message}` },
        { status: 502 }
      );
    }
    logger.error("Critical import error", { error: error.message });
    return NextResponse.json(
      { error: "Critical Server Error: " + error.message },
      { status: 500 }
    );
  }
}
