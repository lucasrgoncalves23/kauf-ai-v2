import { NextResponse } from "next/server";
import { getAllCorrectionsDb, upsertCorrectionDb, initDatabase } from "../../lib/db";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";
import type { Correction } from "../../lib/corrections";

export const runtime = "nodejs";

// The production DB may predate the corrections table; create it on first miss
async function withTableRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (String(error).includes("does not exist")) {
      await initDatabase();
      return await fn();
    }
    throw error;
  }
}

// GET /api/corrections - List all corrections
export async function GET(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const corrections = await withTableRetry(() => getAllCorrectionsDb());
    return NextResponse.json({ corrections });
  } catch (error) {
    logger.error("Failed to fetch corrections", { error: String(error) });
    return NextResponse.json({ error: "Falha ao buscar correções" }, { status: 500 });
  }
}

// POST /api/corrections - Upsert a correction
export async function POST(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Correction;

    if (!body.id || !body.field || !body.original || !body.corrected) {
      return NextResponse.json(
        { error: "Campos obrigatórios: id, field, original, corrected" },
        { status: 400 }
      );
    }

    await withTableRetry(() => upsertCorrectionDb(body));
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to save correction", { error: String(error) });
    return NextResponse.json({ error: "Falha ao salvar correção" }, { status: 500 });
  }
}
