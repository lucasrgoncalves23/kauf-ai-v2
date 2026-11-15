/**
 * Exam text extraction (server-side), shared by the PDF import route and the
 * CRM bridge (exams the patient sent on WhatsApp).
 *
 * PDF: pdf-parse fast path; scanned/empty PDFs go to Claude Vision.
 * Images (JPEG/PNG/WebP/GIF): Claude Vision transcription.
 */

import pdf from "pdf-parse";
import { logger } from "./logger";
import { getAnthropicClient, MODEL, messageText } from "./anthropic";

export const MAX_EXAM_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export type ExamExtraction =
  | { ok: true; text: string; method: "pdf-text" | "pdf-vision" | "image-vision" }
  | { ok: false; error: string; status: 400 | 500 | 502 };

/** Normalizes "image/jpeg; charset=binary" → "image/jpeg". */
export function normalizeMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

export function isSupportedExamMime(mime: string | null | undefined): boolean {
  const type = normalizeMime(mime);
  return type === "application/pdf" || (IMAGE_TYPES as readonly string[]).includes(type);
}

export async function extractExamText(buffer: Buffer, mime: string): Promise<ExamExtraction> {
  const type = normalizeMime(mime);
  const client = getAnthropicClient();
  if (!client) return { ok: false, error: "Missing API Key", status: 500 };

  if (type === "application/pdf") {
    let text = "";
    try {
      const data = await pdf(buffer);
      text = data.text;
    } catch (e) {
      logger.info("PDF parse failed, switching to Vision", { error: String(e) });
    }
    if (text && text.length > 150) return { ok: true, text, method: "pdf-text" };

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
              source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
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
    if (!pdfText) return { ok: false, error: "Resposta inesperada da IA. Tente novamente.", status: 500 };
    return { ok: true, text: pdfText, method: "pdf-vision" };
  }

  if ((IMAGE_TYPES as readonly string[]).includes(type)) {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: type as ImageType, data: buffer.toString("base64") },
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
    if (!imageText) return { ok: false, error: "Resposta inesperada da IA. Tente novamente.", status: 500 };
    return { ok: true, text: imageText, method: "image-vision" };
  }

  return { ok: false, error: "Unsupported file type", status: 400 };
}

export { appendToLayer, formatImportedExam } from "./examFormat";
