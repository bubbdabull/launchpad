import { headers } from "next/headers";

/**
 * Public site base URL (no trailing slash) for absolute links in server actions / metadata.
 * Prefer `NEXT_PUBLIC_APP_URL`; otherwise infer from request headers when available.
 */
export async function getPublicAppOrigin(): Promise<string | null> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const rawProto = h.get("x-forwarded-proto") ?? "";
    const proto =
      rawProto.split(",")[0]?.trim() ||
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}
