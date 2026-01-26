import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // This part replaces the "deleted file" logic with "uploaded file" logic
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdf(buffer);

    return NextResponse.json({ text: data.text });
  } catch (error) {
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}