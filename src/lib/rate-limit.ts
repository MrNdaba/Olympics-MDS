import { headers } from "next/headers";

// In-memory fixed-window rate limiter (spec §19). Sufficient for the single-node
// SQLite deployment; swap for a shared store (Redis) when scaling horizontally.

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let opsSinceSweep = 0;

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/** Consume one unit against `key`. Returns ok=false once the window budget is
 *  exhausted, with the seconds remaining until the window resets. */
export function consumeRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (++opsSinceSweep >= 500) {
    opsSinceSweep = 0;
    sweep(now);
  }

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= max) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP from proxy headers (never trusted for authz). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
