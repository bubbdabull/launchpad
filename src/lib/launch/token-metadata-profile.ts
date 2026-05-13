/**
 * Sparse JSON in `collections.token_metadata_profile`.
 * Wallet-facing copy and socials live elsewhere; this column only keeps
 * optional animation / poster URLs for token metadata JSON.
 */
export type TokenMetadataProfile = {
  /** Static square image URL when `animationUrl` is GIF/MP4. */
  posterImageUrl?: string;
  /** GIF or MP4 URL for explorers (`animation_url` in JSON). */
  animationUrl?: string;
  /**
   * Legacy TikTok URL stored in this column before `token_social_links.tiktok`.
   * Still parsed for migration; not written back by `serializeTokenMetadataProfile`.
   */
  tiktok?: string;
};

const MEDIA_URL_KEYS = ["posterImageUrl", "animationUrl"] as const;

const MAX_URL = 2048;

export function emptyTokenMetadataProfile(): TokenMetadataProfile {
  return {};
}

export function parseTokenMetadataProfileJson(
  raw: string | null | undefined,
): TokenMetadataProfile | null {
  if (raw == null || raw === "") return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const out: TokenMetadataProfile = {};
    for (const k of MEDIA_URL_KEYS) {
      const s = o[k];
      if (typeof s === "string" && s.trim()) {
        out[k] = s.trim().slice(0, MAX_URL);
      }
    }
    const legacyTik = o.tiktok;
    if (typeof legacyTik === "string" && legacyTik.trim()) {
      out.tiktok = legacyTik.trim().slice(0, MAX_URL);
    }
    return out;
  } catch {
    return null;
  }
}

/** Payload for Supabase `token_metadata_profile` jsonb (animation / poster only). */
export function serializeTokenMetadataProfile(p: TokenMetadataProfile): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of MEDIA_URL_KEYS) {
    const v = p[k]?.trim();
    if (v) o[k] = v.slice(0, MAX_URL);
  }
  return o;
}

export function validateTokenMetadataProfile(p: TokenMetadataProfile): string | null {
  for (const k of MEDIA_URL_KEYS) {
    const u = p[k];
    if (!u) continue;
    if (u.length > MAX_URL) return `${k} is too long.`;
    if (!/^https:\/\/.+/i.test(u)) return `${k} must be a full https:// URL.`;
  }
  return null;
}

/** Empty string → `{}`. Invalid JSON / shape → `null`. */
export function tokenMetadataProfileFromForm(form: FormData): TokenMetadataProfile | null {
  const raw = String(form.get("tokenMetadataProfile") ?? "").trim();
  if (!raw) return {};
  return parseTokenMetadataProfileJson(raw);
}
