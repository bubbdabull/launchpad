/**
 * @apiRouteLayer L3
 */


import crypto from "crypto";
import { NextResponse } from "next/server";

import { appendSiwsNonceCookie } from "@/lib/auth/session";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";

export async function GET(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "siws:nonce",
    max: envPositiveInt("RATE_LIMIT_SIWS_NONCE_MAX", 120),
    windowMs: envPositiveInt("RATE_LIMIT_SIWS_NONCE_WINDOW_MS", 15 * 60 * 1000),
  });
  if (limited) return limited;

  const nonce = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.json({ nonce });
  appendSiwsNonceCookie(res, nonce);
  return res;
}
