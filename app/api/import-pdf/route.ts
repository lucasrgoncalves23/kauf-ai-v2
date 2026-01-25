import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { Buffer } from "buffer";

export const runtime = "nodejs";

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

    const result = await pdf(buffer);
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
