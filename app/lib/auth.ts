import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

/**
 * Server-side clinic PIN auth.
 * Fails closed: if CLINIC_PIN is not configured, all protected routes refuse
 * to serve rather than becoming public.
 */

// Hash both sides so buffers are equal-length for timingSafeEqual
function safeCompare(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyClinicPin(
  request: Request
): { ok: true } | { ok: false; response: NextResponse } {
  const clinicPin = process.env.CLINIC_PIN;

  if (!clinicPin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "CLINIC_PIN não configurado no servidor" },
        { status: 503 }
      ),
    };
  }

  const provided = request.headers.get("X-Clinic-Pin");
  if (!provided || !safeCompare(provided, clinicPin)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "PIN inválido" }, { status: 401 }),
    };
  }

  return { ok: true };
}

/**
 * Login attempt throttling (per serverless instance; slows brute-force
 * to a crawl even though instances recycle).
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; windowStart: number }>();

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function checkPinRateLimit(
  request: Request
): { allowed: true } | { allowed: false; retryAfterMin: number } {
  const key = clientKey(request);
  const now = Date.now();

  // Keep the map bounded
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) {
      if (now - v.windowStart > WINDOW_MS) attempts.delete(k);
    }
  }

  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMin: Math.max(1, Math.ceil((entry.windowStart + WINDOW_MS - now) / 60000)),
    };
  }
  return { allowed: true };
}

export function resetPinRateLimit(request: Request): void {
  attempts.delete(clientKey(request));
}

export { safeCompare };
