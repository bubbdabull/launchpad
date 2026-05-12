/**
 * Simple in-memory rate limiting per server instance.
 * For multi-instance production, prefer Redis/Upstash; this still blocks casual abuse and reduces cost.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 50_000;

function prune() {
  const now = Date.now();
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function checkRateLimit(options: {
  key: string;
  max: number;
  windowMs: number;
}): RateLimitResult {
  prune();
  const now = Date.now();
  const bucket = buckets.get(options.key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }

  if (bucket.count >= options.max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
