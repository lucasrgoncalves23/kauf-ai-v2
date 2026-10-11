import { NextResponse } from "next/server";
import { verifyClinicPin } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { revokePublication } from "@/app/lib/portalDb";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const ok = await revokePublication(id);
    if (!ok) return NextResponse.json({ error: "Publicação não encontrada ou já revogada." }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("Portal revoke failed", { error: String(err) });
    return NextResponse.json({ error: "Falha ao revogar." }, { status: 500 });
  }
}
