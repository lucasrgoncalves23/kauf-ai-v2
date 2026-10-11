// In-memory fixed window, per serverless instance. The DB-side attempt counter is the
// real control; this only blunts bursts against a single instance.
export function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return {
    check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now - v.windowStart > windowMs) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        hits.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryAfterMs: 0 };
      }
      entry.count++;
      if (entry.count > max) return { allowed: false, retryAfterMs: entry.windowStart + windowMs - now };
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
