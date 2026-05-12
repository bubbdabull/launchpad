/** Optional row: label a linked NFT / pass (same SPL umbrella); mint + art optional until deployed. */
export type PairedNftEntry = {
  name?: string;
  /** Metaplex Core / SPL mint address (base58), when deployed. */
  mint?: string;
  /** https preview art (merged into `properties.files` + `properties.paired_nfts`). */
  image?: string;
};

/** Rich explorer / DEX-facing copy stored in `collections.token_metadata_profile`. */
export type TokenMetadataProfile = {
  story?: string;
  roadmap?: string;
  community?: string;
  github?: string;
  youtube?: string;
  tiktok?: string;
  /** Static square image URL for wallet list icon when `animationUrl` is GIF/MP4. */
  posterImageUrl?: string;
  /** GIF or MP4 URL for explorers / detail views (`animation_url` in JSON). */
  animationUrl?: string;
  /**
   * When one SPL token represents a family of NFT collections (e.g. multiple passes),
   * list each with optional mint + art so indexers can show multi-asset context.
   */
  pairedNfts?: PairedNftEntry[];
};

const TEXT_KEYS = ["story", "roadmap", "community"] as const;
const URL_KEYS = ["github", "youtube", "tiktok"] as const;
const MEDIA_URL_KEYS = ["posterImageUrl", "animationUrl"] as const;

const MAX_TEXT = 2500;
const MAX_URL = 2048;
const MAX_PAIRED = 24;
const MAX_PAIR_NAME = 80;
const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function emptyTokenMetadataProfile(): TokenMetadataProfile {
  return {};
}

function parsePairedNfts(v: unknown): PairedNftEntry[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: PairedNftEntry[] = [];
  for (const row of v) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const name =
      typeof o.name === "string" ? o.name.trim().slice(0, MAX_PAIR_NAME) : "";
    const mintRaw = typeof o.mint === "string" ? o.mint.trim() : "";
    const mint = SOLANA_MINT_RE.test(mintRaw) ? mintRaw : undefined;
    const imageRaw = typeof o.image === "string" ? o.image.trim().slice(0, MAX_URL) : "";
    const image = /^https:\/\/.+/i.test(imageRaw) ? imageRaw : undefined;
    if (!name && !mint && !image) continue;
    const entry: PairedNftEntry = {};
    if (name) entry.name = name;
    if (mint) entry.mint = mint;
    if (image) entry.image = image;
    out.push(entry);
    if (out.length >= MAX_PAIRED) break;
  }
  return out.length ? out : undefined;
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
    for (const k of TEXT_KEYS) {
      const s = o[k];
      if (typeof s === "string" && s.trim()) out[k] = s.trim().slice(0, MAX_TEXT);
    }
    for (const k of URL_KEYS) {
      const s = o[k];
      if (typeof s === "string" && s.trim()) out[k] = s.trim().slice(0, MAX_URL);
    }
    for (const k of MEDIA_URL_KEYS) {
      const s = o[k];
      if (typeof s === "string" && s.trim()) {
        const v = s.trim().slice(0, MAX_URL);
        if (k === "posterImageUrl") out.posterImageUrl = v;
        if (k === "animationUrl") out.animationUrl = v;
      }
    }
    const paired = parsePairedNfts(o.pairedNfts);
    if (paired) out.pairedNfts = paired;
    return out;
  } catch {
    return null;
  }
}

/** Payload for Supabase `token_metadata_profile` jsonb (sparse object). */
export function serializeTokenMetadataProfile(p: TokenMetadataProfile): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) {
    const v = p[k]?.trim();
    if (v) o[k] = v.slice(0, MAX_TEXT);
  }
  for (const k of URL_KEYS) {
    const v = p[k]?.trim();
    if (v) o[k] = v.slice(0, MAX_URL);
  }
  for (const k of MEDIA_URL_KEYS) {
    const v = p[k]?.trim();
    if (v) o[k] = v.slice(0, MAX_URL);
  }
  const paired = sanitizePairedNftsForSave(p.pairedNfts);
  if (paired.length) o.pairedNfts = paired;
  return o;
}

function sanitizePairedNftsForSave(rows: PairedNftEntry[] | undefined): PairedNftEntry[] {
  if (!rows?.length) return [];
  const out: PairedNftEntry[] = [];
  for (const row of rows) {
    const name = row.name?.trim().slice(0, MAX_PAIR_NAME) ?? "";
    const mintRaw = row.mint?.trim() ?? "";
    const mint = SOLANA_MINT_RE.test(mintRaw) ? mintRaw : undefined;
    const imageRaw = row.image?.trim() ?? "";
    const image = /^https:\/\/.+/i.test(imageRaw) ? imageRaw.slice(0, MAX_URL) : undefined;
    if (!name && !mint && !image) continue;
    const e: PairedNftEntry = {};
    if (name) e.name = name;
    if (mint) e.mint = mint;
    if (image) e.image = image;
    out.push(e);
    if (out.length >= MAX_PAIRED) break;
  }
  return out;
}

export function validateTokenMetadataProfile(p: TokenMetadataProfile): string | null {
  for (const k of TEXT_KEYS) {
    const t = p[k];
    if (t && t.length > MAX_TEXT) return `${k} is too long (max ${MAX_TEXT} characters).`;
  }
  for (const k of URL_KEYS) {
    const u = p[k];
    if (!u) continue;
    if (u.length > MAX_URL) return `${k} link is too long.`;
    if (!/^https:\/\/.+/i.test(u)) return `${k} must be a full https:// URL.`;
  }
  for (const k of MEDIA_URL_KEYS) {
    const u = p[k];
    if (!u) continue;
    if (u.length > MAX_URL) return `${k} is too long.`;
    if (!/^https:\/\/.+/i.test(u)) return `${k} must be a full https:// URL.`;
  }
  const rows = (p.pairedNfts ?? []).filter((r) => {
    const name = r.name?.trim() ?? "";
    const mintRaw = r.mint?.trim() ?? "";
    const img = r.image?.trim() ?? "";
    return Boolean(name || mintRaw || img);
  });
  if (!rows.length) return null;
  if (rows.length > MAX_PAIRED) return `At most ${MAX_PAIRED} paired NFT rows.`;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r.name?.trim() ?? "";
    const mintRaw = r.mint?.trim() ?? "";
    const img = r.image?.trim() ?? "";
    if (mintRaw && !SOLANA_MINT_RE.test(mintRaw)) {
      return `Paired NFT row ${i + 1}: mint must be a valid Solana address or empty.`;
    }
    if (img && !/^https:\/\/.+/i.test(img)) {
      return `Paired NFT row ${i + 1}: image must be https:// or empty.`;
    }
    if (name.length > MAX_PAIR_NAME) return `Paired NFT row ${i + 1}: name is too long.`;
  }
  return null;
}

/** Empty string → `{}`. Invalid JSON / shape → `null`. */
export function tokenMetadataProfileFromForm(form: FormData): TokenMetadataProfile | null {
  const raw = String(form.get("tokenMetadataProfile") ?? "").trim();
  if (!raw) return {};
  return parseTokenMetadataProfileJson(raw);
}
