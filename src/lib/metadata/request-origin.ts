import type { NextRequest } from "next/server";

/** Build absolute site origin for metadata `image` / `external_url` resolution. */
export function inferRequestOrigin(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = forwarded ?? req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
  if (host) return `${proto}://${host}`;
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  return "http://localhost:3000";
}
