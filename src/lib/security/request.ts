/**
 * Bounded JSON body parsing to reduce JSON bomb / huge payload DoS.
 */

const DEFAULT_MAX_JSON_BYTES = 48 * 1024;

export async function readJsonBody<T>(
  req: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const len = req.headers.get("content-length");
  if (len && Number(len) > maxBytes) {
    return { ok: false, error: "Request body too large" };
  }

  const text = await req.text();
  if (text.length > maxBytes) {
    return { ok: false, error: "Request body too large" };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}
