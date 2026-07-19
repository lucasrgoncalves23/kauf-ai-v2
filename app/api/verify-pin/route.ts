import { NextResponse } from "next/server";
import { checkPinRateLimit, resetPinRateLimit, safeCompare } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clinicPin = process.env.CLINIC_PIN;

  // Fail closed: without a configured PIN, nobody gets in
  if (!clinicPin) {
    return NextResponse.json(
      { valid: false, error: "CLINIC_PIN não configurado no servidor" },
      { status: 503 }
    );
  }

  const rate = checkPinRateLimit(request);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: `Muitas tentativas. Aguarde ${rate.retryAfterMin} min.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ valid: false, error: "PIN obrigatorio" }, { status: 400 });
    }

    if (safeCompare(pin, clinicPin)) {
      resetPinRateLimit(request);
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false, error: "PIN incorreto" }, { status: 401 });
  } catch {
    return NextResponse.json({ valid: false, error: "Requisicao invalida" }, { status: 400 });
  }
}
