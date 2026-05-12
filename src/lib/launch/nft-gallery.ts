/** Parse JSON array of https URLs from create/manage hidden fields. */

const MAX_ITEMS = 12;
const MAX_URL_LEN = 2048;

export function parseNftGalleryUrlsJson(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === "" || raw === "[]") return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    const out: string[] = [];
    for (const x of v.slice(0, MAX_ITEMS)) {
      if (typeof x !== "string") return null;
      const s = x.trim();
      if (!s) continue;
      if (s.length > MAX_URL_LEN) return null;
      if (!/^https:\/\/.+/i.test(s)) return null;
      out.push(s);
    }
    return out;
  } catch {
    return null;
  }
}

export function isHttpsUrl(value: string): boolean {
  if (!value) return false;
  return /^https:\/\/.+/i.test(value);
}
