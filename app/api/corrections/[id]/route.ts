import { NextResponse } from "next/server";
import { deleteCorrectionDb } from "../../../lib/db";
import { logger } from "@/app/lib/logger";
import { verifyClinicPin } from "@/app/lib/auth";

export const runtime = "nodejs";

// DELETE /api/corrections/[id] - Delete a correction
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyClinicPin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const deleted = await deleteCorrectionDb(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    logger.error("Failed to delete correction", { error: String(error) });
    return NextResponse.json({ error: "Falha ao excluir correção" }, { status: 500 });
  }
}
