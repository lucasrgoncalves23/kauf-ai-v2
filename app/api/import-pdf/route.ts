import { NextResponse } from "next/server";
import { Buffer } from "buffer";
import { createRequire } from "module";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);

// IMPORTANT: import the real parser (not the demo entry)
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file uploaded (expected form field: file)." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await pdfParse(buffer);
    const text = (result?.text ?? "").trim();

    return NextResponse.json({
      ok: true,
      filename: file.name,
      bytes: file.size,
      text,
      numPages: result?.numpages,
    });
  } catch (err: any) {
    console.error("[import-pdf] ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
