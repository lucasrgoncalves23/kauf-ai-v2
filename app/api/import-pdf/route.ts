import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";
import { MAX_EXAM_BYTES, extractExamText } from "@/app/lib/examText";

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
    if (file.size > MAX_EXAM_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 4MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const result = await extractExamText(buffer, file.type);
      if (!result.ok) {
        if (result.status === 500 && result.error !== "Missing API Key") {
          logger.error("Unexpected AI response structure for exam");
        }
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ text: result.text });
    } catch (e) {
      if (e instanceof Anthropic.APIError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      logger.error("PDF processing failed", { error: message });
      return NextResponse.json(
        { error: "Server Error processing PDF: " + message },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `IA indisponível (${error.status}): ${error.message}` },
        { status: 502 }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Critical import error", { error: message });
    return NextResponse.json(
      { error: "Critical Server Error: " + message },
      { status: 500 }
    );
  }
}
