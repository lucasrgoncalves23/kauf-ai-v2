import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clinicPin = process.env.CLINIC_PIN;

  // If no PIN configured, always allow
  if (!clinicPin) {
    return NextResponse.json({ valid: true });
  }

  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json({ valid: false, error: "PIN obrigatorio" }, { status: 400 });
    }

    if (pin === clinicPin) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false, error: "PIN incorreto" }, { status: 401 });
  } catch {
    return NextResponse.json({ valid: false, error: "Requisicao invalida" }, { status: 400 });
  }
}
