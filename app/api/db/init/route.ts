import { NextResponse } from "next/server";
import { initDatabase, checkDatabaseConnection } from "../../../lib/db";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

// POST /api/db/init - Initialize database tables
// This should be called once during setup
export async function POST(request: Request) {
  // Only allow in development or with admin key
  const adminKey = process.env.ADMIN_KEY;
  const providedKey = request.headers.get("X-Admin-Key");

  if (adminKey && providedKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check connection first
    const connected = await checkDatabaseConnection();
    if (!connected) {
      return NextResponse.json(
        { error: "Could not connect to database. Check DATABASE_URL." },
        { status: 500 }
      );
    }

    // Initialize tables
    await initDatabase();

    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
    });
  } catch (error) {
    logger.error("Failed to initialize database", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to initialize database", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/db/init - Check database status
export async function GET() {
  try {
    const connected = await checkDatabaseConnection();
    return NextResponse.json({
      connected,
      databaseConfigured: !!process.env.DATABASE_URL,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: String(error),
    });
  }
}
