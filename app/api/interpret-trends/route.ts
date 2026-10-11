import { buildTrendInterpretationPrompt, type TrendSeriesInput } from "@/app/lib/prompts";
import { verifyClinicPin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL, streamToSSE } from "@/app/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SERIES = 40;
const MAX_POINTS = 50;

function sanitizeSeries(raw: unknown): TrendSeriesInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_SERIES).flatMap((s) => {
    if (!s || typeof s.label !== "string" || !Array.isArray(s.points)) return [];
    const points = s.points
      .slice(-MAX_POINTS)
      .filter((p: any) => p && typeof p.label === "string" && Number.isFinite(p.value))
      .map((p: any) => ({ label: p.label.slice(0, 20), value: p.value }));
    if (points.length === 0) return [];
    return [{
      label: s.label.slice(0, 60),
      unit: typeof s.unit === "string" ? s.unit.slice(0, 20) : "",
      ref: typeof s.ref === "string" ? s.ref.slice(0, 40) : "",
      points,
    }];
  });
}

export async function POST(req: Request) {
  const auth = verifyClinicPin(req);
  if (!auth.ok) return auth.response;

  const client = getAnthropicClient();
  if (!client) {
    return Response.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const series = sanitizeSeries(body.series);
    if (series.length === 0) {
      return Response.json({ error: "Nenhum marcador para interpretar." }, { status: 400 });
    }

    const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 30) : undefined);
    const { system, user } = buildTrendInterpretationPrompt({
      series,
      patientSex: str(body.patientSex),
      patientAge: str(body.patientAge),
      phase: str(body.phase),
    });

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.3,
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal: req.signal }
    );

    return streamToSSE(stream);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
