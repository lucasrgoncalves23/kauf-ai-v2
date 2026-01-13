

import { NextRequest, NextResponse } from "next/server";
import type { ClinicalInput } from "@/app/types/clinical";
import { runEngine } from "@/app/lib/engine";

export async function POST(req: NextRequest) {
  const input = (await req.json()) as ClinicalInput;

  const { decision, report } = runEngine(input);

  return NextResponse.json({
    status: "ok",
    decision,
    report,
  });
}
