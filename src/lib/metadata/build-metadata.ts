import type { TokenMetadataProfile } from "@/lib/launch/token-metadata-profile";
import type { TokenSocialLinks } from "@/lib/launch/token-social";
import type { Collection } from "@/types/collection";

function absoluteUrl(path: string, origin: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = origin.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Brand URL indexers show as “created on” (Moonshot / pump.fun style). */
function createdOnLabel(origin: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_METADATA_CREATED_ON?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return origin.replace(/\/$/, "");
}

const MAX_COMPOSED_DESCRIPTION = 7500;

/** Merge `token_social_links` with legacy `token_metadata_profile.tiktok` until rows are re-saved. */
function socialForWalletMetadata(c: Collection): TokenSocialLinks {
  const s = { ...(c.tokenSocialLinks ?? {}) };
  const st = s.tiktok?.trim();
  const legacy = c.tokenMetadataProfile?.tiktok?.trim();
  if (!st && legacy) {
    s.tiktok = legacy;
  }
  return s;
}

function compactExtensions(
  social: TokenSocialLinks,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const k of ["website", "twitter", "discord", "telegram", "tiktok"] as const) {
    const v = social[k]?.trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function composeRichDescription(
  mainDescription: string,
  tagline: string | undefined,
  /** When true, lead with tagline then blank line before the main body. */
  leadWithTagline: boolean,
): string {
  const parts: string[] = [];
  if (leadWithTagline && tagline?.trim()) {
    parts.push(tagline.trim(), "", mainDescription.trim());
  } else {
    parts.push(mainDescription.trim());
  }
  return parts.join("\n").trim().slice(0, MAX_COMPOSED_DESCRIPTION);
}

/** Top-level social keys (pump.fun / many Solana indexers read these in addition to `extensions`). */
function topLevelSocialFields(
  social: TokenSocialLinks,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["website", "twitter", "discord", "telegram", "tiktok"] as const) {
    const v = social[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

/** DEXScreener-style link objects (alongside `extensions`). */
function dexLinksFromSocial(
  social: TokenSocialLinks,
): Array<{ type: string; label: string; url: string }> {
  const pairs: Array<[string, string, string | undefined]> = [
    ["website", "Website", social.website],
    ["twitter", "Twitter", social.twitter],
    ["discord", "Discord", social.discord],
    ["telegram", "Telegram", social.telegram],
    ["tiktok", "TikTok", social.tiktok],
  ];
  const links: Array<{ type: string; label: string; url: string }> = [];
  for (const [type, label, url] of pairs) {
    const u = url?.trim();
    if (u) links.push({ type, label, url: u });
  }
  return links;
}

function tokenDiscoveryAttributes(c: Collection): Array<{
  trait_type: string;
  value: string;
}> {
  const traits: Array<{ trait_type: string; value: string }> = [
    { trait_type: "Launchpad", value: "Creator Launchpad" },
    { trait_type: "Launch", value: c.slug },
  ];
  if (c.category?.trim()) {
    traits.push({ trait_type: "Category", value: c.category.trim() });
  }
  if (c.tokenSymbol?.trim()) {
    traits.push({ trait_type: "Symbol", value: c.tokenSymbol.trim() });
  }
  if (c.phase?.trim()) {
    traits.push({ trait_type: "Phase", value: c.phase.trim() });
  }
  if (c.alphaVault?.trim()) {
    traits.push({ trait_type: "Primary sale", value: "Meteora Alpha Vault" });
  }
  if (c.dammPool?.trim()) {
    traits.push({
      trait_type: "Infra · DAMM pool",
      value: "Cached pubkey for explorers — not lifecycle or LaunchState",
    });
  }
  return traits;
}

/** Primary image for token + NFT metadata (wallets expect a single `image`). */
export function primaryImageUrl(c: Pick<Collection, "logoUrl" | "bannerUrl">, origin: string): string {
  const raw = c.logoUrl || c.bannerUrl;
  return absoluteUrl(raw, origin);
}

function mimeFromUri(uri: string): string {
  const path = uri.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".png")) return "image/png";
  return "image/png";
}

function filesFromGallery(
  c: Pick<Collection, "logoUrl" | "bannerUrl" | "nftGalleryUrls">,
  origin: string,
): Array<{ uri: string; type: string; cdn?: boolean }> {
  const files: Array<{ uri: string; type: string; cdn?: boolean }> = [];
  const seen = new Set<string>();
  const push = (uri: string) => {
    if (!uri) return;
    const abs = absoluteUrl(uri, origin);
    if (seen.has(abs)) return;
    seen.add(abs);
    files.push({ uri: abs, type: mimeFromUri(abs) });
  };
  push(c.logoUrl);
  push(c.bannerUrl);
  for (const u of c.nftGalleryUrls ?? []) {
    push(u);
  }
  return files;
}

/**
 * Fungible token JSON for Meteora / SPL metadata URI (`/api/metadata/token/[slug]`).
 */
export function buildTokenMetadataJson(
  c: Collection,
  origin: string,
): Record<string, unknown> {
  const social = socialForWalletMetadata(c);
  const profile = c.tokenMetadataProfile;
  const files = filesFromGallery(c, origin);
  const base = origin.replace(/\/$/, "");
  const extensions = compactExtensions(social);
  const links = dexLinksFromSocial(social);
  const topSocial = topLevelSocialFields(social);
  const bannerAbs = c.bannerUrl ? absoluteUrl(c.bannerUrl, origin) : undefined;
  const logoAbs = c.logoUrl ? absoluteUrl(c.logoUrl, origin) : undefined;
  const description = composeRichDescription(c.description, undefined, false);

  const propsBase: Record<string, unknown> = {
    category: "image",
    files,
  };

  const poster = profile?.posterImageUrl?.trim();
  const anim = profile?.animationUrl?.trim();
  const imageField = poster ? absoluteUrl(poster, origin) : primaryImageUrl(c, origin);

  const out: Record<string, unknown> = {
    name: c.name,
    symbol: c.tokenSymbol ?? "TOKEN",
    description,
    image: imageField,
    external_url: social.website?.trim() || `${base}/project/${c.slug}`,
    // Moonshot / pump.fun style fields many Solana indexers (incl. DEXScreener) surface.
    showName: true,
    createdOn: createdOnLabel(origin),
    properties: propsBase,
    attributes: tokenDiscoveryAttributes(c),
    ...topSocial,
  };

  if (c.utilities?.length) {
    out.tags = c.utilities.slice(0, 24);
  }

  if (anim) {
    out.animation_url = absoluteUrl(anim, origin);
  }

  if (bannerAbs && (!logoAbs || bannerAbs !== out.image)) {
    out.banner = bannerAbs;
  }
  if (extensions) out.extensions = extensions;
  if (links.length) out.links = links;

  return out;
}

/**
 * Metaplex Core collection parent JSON (`/api/metadata/collection/[slug]`).
 */
export function buildCollectionMetadataJson(
  c: Collection,
  origin: string,
): Record<string, unknown> {
  const social = socialForWalletMetadata(c);
  const files = filesFromGallery(c, origin);
  const base = origin.replace(/\/$/, "");
  const extensions = compactExtensions(social);
  const links = dexLinksFromSocial(social);
  const topSocial = topLevelSocialFields(social);
  const bannerAbs = c.bannerUrl ? absoluteUrl(c.bannerUrl, origin) : undefined;
  const logoAbs = c.logoUrl ? absoluteUrl(c.logoUrl, origin) : undefined;
  const image = primaryImageUrl(c, origin);
  const description = composeRichDescription(c.description, c.tagline, true);

  const propsCol: Record<string, unknown> = { category: "image", files };

  const out: Record<string, unknown> = {
    name: `${c.name} — Genesis Pass`,
    symbol: "PASS",
    description,
    image,
    external_url: social.website?.trim() || `${base}/project/${c.slug}`,
    showName: true,
    createdOn: createdOnLabel(origin),
    properties: propsCol,
    attributes: tokenDiscoveryAttributes(c),
    ...topSocial,
  };
  if (c.utilities?.length) {
    out.tags = c.utilities.slice(0, 24);
  }
  if (bannerAbs && (!logoAbs || bannerAbs !== image)) out.banner = bannerAbs;
  if (extensions) out.extensions = extensions;
  if (links.length) out.links = links;
  return out;
}

/**
 * Single Genesis Pass asset JSON (`/api/metadata/asset/[address]`).
 * Merges on-chain attribute receipt with launch-level art + links.
 */
export function buildAssetMetadataJson(input: {
  collection: Collection;
  origin: string;
  assetName: string;
  chainAttributes: Array<{ trait_type?: string; value?: string }>;
}): Record<string, unknown> {
  const { collection: c, origin, assetName, chainAttributes } = input;
  const social = socialForWalletMetadata(c);
  const files = filesFromGallery(c, origin);
  const base = origin.replace(/\/$/, "");
  const extensions = compactExtensions(social);
  const links = dexLinksFromSocial(social);
  const topSocial = topLevelSocialFields(social);
  const bannerAbs = c.bannerUrl ? absoluteUrl(c.bannerUrl, origin) : undefined;
  const logoAbs = c.logoUrl ? absoluteUrl(c.logoUrl, origin) : undefined;
  const image = primaryImageUrl(c, origin);
  const description = composeRichDescription(c.description, undefined, false);

  const attributes = [
    ...chainAttributes,
    { trait_type: "Launchpad", value: "Creator Launchpad" },
    { trait_type: "Launch", value: c.slug },
  ];

  const propsAsset: Record<string, unknown> = { category: "image", files };

  const out: Record<string, unknown> = {
    name: assetName,
    symbol: c.tokenSymbol ?? "PASS",
    description,
    image,
    external_url: social.website?.trim() || `${base}/project/${c.slug}`,
    showName: true,
    createdOn: createdOnLabel(origin),
    attributes,
    properties: propsAsset,
    ...topSocial,
  };
  if (c.utilities?.length) {
    out.tags = c.utilities.slice(0, 24);
  }
  if (bannerAbs && (!logoAbs || bannerAbs !== image)) out.banner = bannerAbs;
  if (extensions) out.extensions = extensions;
  if (links.length) out.links = links;
  return out;
}
