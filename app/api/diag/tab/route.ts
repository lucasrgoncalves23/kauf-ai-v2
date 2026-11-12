import { NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

const MAX_BODY_CHARS = 64_000;
const MAX_SESSIONS = 10;

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    const sql = getDb();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS client_tab_diag (
        session_id TEXT PRIMARY KEY,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        ua TEXT,
        payload JSONB NOT NULL
      )
    `.then(() => undefined);
    tableReady.catch(() => {
      tableReady = null;
    });
  }
  return tableReady;
}

// POST /api/diag/tab — tab-loss diagnostics from the dashboard (see lib/tabDiagnostics.ts)
export async function POST(request: Request) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
    const body = JSON.parse(text) as { sessions?: unknown };
    const sessions = Array.isArray(body.sessions) ? body.sessions.slice(0, MAX_SESSIONS) : [];

    await ensureTable();
    const sql = getDb();
    for (const raw of sessions) {
      const s = raw as { id?: unknown; startedAt?: unknown; ua?: unknown };
      if (typeof s?.id !== "string" || s.id.length > 64) continue;
      const startedAt = typeof s.startedAt === "string" ? s.startedAt : null;
      const ua = typeof s.ua === "string" ? s.ua.slice(0, 400) : null;
      await sql`
        INSERT INTO client_tab_diag (session_id, started_at, ua, payload)
        VALUES (${s.id}, ${startedAt}, ${ua}, ${JSON.stringify(raw)}::jsonb)
        ON CONFLICT (session_id) DO UPDATE
          SET payload = EXCLUDED.payload, received_at = NOW()
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.warn("Failed to store tab diagnostics", { error: String(error) });
    return NextResponse.json({ error: "invalid diagnostics payload" }, { status: 400 });
  }
}
