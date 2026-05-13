/**
 * True when `url` is an https public object URL for this project’s collection-assets bucket
 * (same host as `NEXT_PUBLIC_SUPABASE_URL`, `/storage/v1/object/public/<bucket>/…`).
 * Used to enforce upload-only token images on create while still allowing any https on manage.
 */
export function isCollectionAssetPublicUrl(url: string): boolean {
  const raw = url.trim();
  if (!/^https:\/\//i.test(raw)) return false;
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseBase) return false;
  let expectedHost: string;
  try {
    expectedHost = new URL(supabaseBase).hostname.toLowerCase();
  } catch {
    return false;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.hostname.toLowerCase() !== expectedHost) return false;
  const bucket = (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "collection-assets").replace(/\/+$/, "");
  const path = u.pathname;
  const prefix = `/storage/v1/object/public/${bucket}/`;
  return path.startsWith(prefix);
}