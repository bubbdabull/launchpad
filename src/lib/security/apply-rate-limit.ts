import { NextResponse } from "next/server";

import { checkRateLimit, clientIp, type RateLimitResult } from "@/lib/security/rate-limit";

export function rateLimitOr429(
  req: Request,
  options: { prefix: string; max: number; windowMs: number; extraKey?: string },
): NextResponse | null {
  const ip = clientIp(req);
  const key = `${options.prefix}:${ip}:${options.extraKey ?? ""}`;
  const result: RateLimitResult = checkRateLimit({
    key,
    max: options.max,
    windowMs: options.windowMs,
  });

  if (result.ok) return null;

  return NextResponse.json(
    { ok: false, error: "Too many requests. Try again later.", retryAfter: result.retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}
