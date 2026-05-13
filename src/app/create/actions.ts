"use server";

import { revalidatePath } from "next/cache";

import { getWalletSession } from "@/lib/auth/session";
import { explainLaunchEconomicsError, validateLaunchEconomicsInputs } from "@/lib/launch/launch-economics-policy";
import { deserializeMintTiers } from "@/lib/launch/mint-tiers";
import { parseNftGalleryUrlsJson } from "@/lib/launch/nft-gallery";
import {
  serializeTokenMetadataProfile,
  tokenMetadataProfileFromForm,
  validateTokenMetadataProfile,
} from "@/lib/launch/token-metadata-profile";
import { isValidAccentColor, sanitizeProjectPageDoc } from "@/lib/launch/project-page";
import {
  serializeTokenSocialLinks,
  tokenSocialLinksFromForm,
  validateTokenSocialLinks,
} from "@/lib/launch/token-social";
import { createServiceRoleClient } from "@/lib/supabase/server";

const slugRegex = /^[a-z0-9-]{3,64}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_SYMBOL_RE = /^[A-Z0-9]{2,10}$/;

function isHttpsUrl(value: string): boolean {
  return /^https:\/\/.+/.test(value);
}

function asText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function ensureSolanaAddress(value: string, field: string) {
  if (!value) return null;
  if (!SOLANA_ADDRESS_RE.test(value)) return `${field} must be a valid Solana address.`;
  return null;
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const U64_MAX = (1n << 64n) - 1n;

function parseNonNegU64String(
  raw: string,
  fallback: bigint,
): { ok: true; value: bigint } | { ok: false; message: string } {
  const s = raw.replace(/_/g, "").trim();
  if (!s) return { ok: true, value: fallback };
  if (!/^\d+$/.test(s)) {
    return { ok: false, message: "On-chain timing fields must be non-negative integers (digits only)." };
  }
  try {
    let v = BigInt(s);
    if (v < 0n) return { ok: false, message: "On-chain timing fields cannot be negative." };
    if (v > U64_MAX) v = U64_MAX;
    return { ok: true, value: v };
  } catch {
    return { ok: false, message: "On-chain timing value is not a valid integer." };
  }
}

function parseLamports(value: string): bigint | null {
  if (!value) return BigInt(0);
  const cleaned = value.replace(/_/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  if (cleaned.includes(".")) {
    const [whole, frac] = cleaned.split(".");
    const padded = (frac + "0".repeat(9)).slice(0, 9);
    try {
      return BigInt(whole) * BigInt(1_000_000_000) + BigInt(padded);
    } catch {
      return null;
    }
  }
  try {
    return BigInt(cleaned) * BigInt(1_000_000_000);
  } catch {
    return null;
  }
}

export type CreateLaunchState = {
  ok: boolean;
  message?: string;
};

export async function createDraftCollection(
  _prev: CreateLaunchState,
  form: FormData,
): Promise<CreateLaunchState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in with your wallet first." };

  const slug = asText(form, "slug").toLowerCase();
  const name = asText(form, "name");
  const tagline = asText(form, "tagline");
  const description = asText(form, "description");
  const bannerUrl = asText(form, "bannerUrl");
  const logoUrl = asText(form, "logoUrl");
  const nftGalleryUrlsRaw = asText(form, "nftGalleryUrls");
  const nftGalleryParsed = parseNftGalleryUrlsJson(nftGalleryUrlsRaw || "[]");
  if (nftGalleryParsed === null) {
    return {
      ok: false,
      message: "Extra artwork must be a JSON array of https image URLs (or leave it empty).",
    };
  }
  const tokenSocial = tokenSocialLinksFromForm(form);
  const socialErr = validateTokenSocialLinks(tokenSocial);
  if (socialErr) return { ok: false, message: socialErr };
  const tokenMetaProfileParsed = tokenMetadataProfileFromForm(form);
  if (tokenMetaProfileParsed === null) {
    return { ok: false, message: "Token metadata profile JSON was invalid." };
  }
  const profileErr = validateTokenMetadataProfile(tokenMetaProfileParsed);
  if (profileErr) return { ok: false, message: profileErr };
  const phase = asText(form, "phase");
  const supply = Number(asText(form, "supply"));
  const utilities = asText(form, "utilities")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const priceLabel = asText(form, "priceLabel");
  const mintPriceSol = asText(form, "mintPriceSol");
  const mintPriceLamports = parseLamports(mintPriceSol);
  const quoteAsset = asText(form, "quoteAsset").toUpperCase() === "USDC" ? "USDC" : "SOL";

  const tokenName = asText(form, "tokenName");
  const tokenSymbol = asText(form, "tokenSymbol").toUpperCase();

  const accentColorRaw = asText(form, "accentColor");
  if (accentColorRaw && !isValidAccentColor(accentColorRaw)) {
    return { ok: false, message: "Accent color must be empty or valid hex (#RGB or #RRGGBB)." };
  }
  const accentColorForRow = accentColorRaw && isValidAccentColor(accentColorRaw) ? accentColorRaw : null;

  const heroLayoutRaw = asText(form, "heroLayout");
  const heroLayoutForRow =
    heroLayoutRaw === "minimal" || heroLayoutRaw === "split" || heroLayoutRaw === "classic"
      ? heroLayoutRaw
      : null;

  const projectHeadlineRaw = asText(form, "projectHeadline").slice(0, 200);
  const projectSubheadRaw = asText(form, "projectSubhead").slice(0, 400);

  let projectPageForRow = sanitizeProjectPageDoc({})!;
  const ppRaw = asText(form, "projectPagePayload");
  if (ppRaw) {
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(ppRaw);
    } catch {
      return { ok: false, message: "Project page payload was not valid JSON." };
    }
    projectPageForRow = sanitizeProjectPageDoc(parsedPayload) ?? projectPageForRow;
  }

  const creatorTreasury = asText(form, "creatorTreasury");
  const platformTreasury = (process.env.PLATFORM_TREASURY ?? "").trim();
  // Genesis mint tax is 7% of mint price on-chain (launch-controller); see `genesis-mint-tax.ts`.
  // Keep the legacy column at 0 so the row remains valid.
  const platformFeeBps = 0;

  // Per-launch split of the creator fee pot between the creator
  // wallet and Genesis Pass holders. 0 = 100% creator, 100 = 100% holders.
  const holderRewardPctRaw = Number(asText(form, "holderRewardPct"));
  const holderRewardPct =
    Number.isFinite(holderRewardPctRaw) && holderRewardPctRaw >= 0 && holderRewardPctRaw <= 100
      ? Math.round(holderRewardPctRaw)
      : 50;

  /** Mirrors the trading-tax holder split as basis points for on-chain deploy (`set_nft_holder_share_bps`). */
  const nftHolderShareBps = clampInt(holderRewardPct * 100, 0, 10_000, 0);

  const vestingSlots = parseNonNegU64String(asText(form, "creatorRewardVestingSlots"), 216_000n);
  if (!vestingSlots.ok) return { ok: false, message: vestingSlots.message };
  const delaySlots = parseNonNegU64String(asText(form, "creatorRewardClaimStartDelaySlots"), 0n);
  if (!delaySlots.ok) return { ok: false, message: delaySlots.message };
  const cooldownSlots = parseNonNegU64String(asText(form, "creatorRewardTransferCooldownSlots"), 0n);
  if (!cooldownSlots.ok) return { ok: false, message: cooldownSlots.message };
  const maxClaimPerEpoch = parseNonNegU64String(asText(form, "creatorRewardMaxClaimPerEpoch"), U64_MAX);
  if (!maxClaimPerEpoch.ok) return { ok: false, message: maxClaimPerEpoch.message };

  const incentiveBpsRaw = Number(asText(form, "creatorRewardIncentiveShareBps"));
  const creatorRewardIncentiveShareBps = Number.isFinite(incentiveBpsRaw)
    ? clampInt(incentiveBpsRaw, 0, 10_000, 0)
    : 0;

  const immRaw = asText(form, "creatorRewardImmutableAfterLaunch");
  const creatorRewardImmutableAfterLaunch =
    immRaw === "1" || immRaw.toLowerCase() === "true" || immRaw.toLowerCase() === "on";

  // Creator vesting (locked token allocation, released on a schedule after unlock).
  const vestingPct = clampInt(Number(asText(form, "creatorVestingSupplyPct")), 0, 50, 0);
  const vestingCliff = clampInt(Number(asText(form, "creatorVestingCliffMonths")), 0, 24, 0);
  const vestingPeriod = clampInt(Number(asText(form, "creatorVestingPeriodMonths")), 1, 60, 12);
  const tokenHolderRewardPct = clampInt(Number(asText(form, "tokenHolderRewardPct")), 0, 100, 0);
  const sliceBPct = clampInt(Number(asText(form, "sliceBPct")), 0, 10, 0);
  const sliceBCreatorSharePct = clampInt(Number(asText(form, "sliceBCreatorSharePct")), 0, 100, 50);

  const tiersRaw = asText(form, "mintTiers");
  if (tiersRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(tiersRaw);
    } catch {
      return { ok: false, message: "Mint tiers payload was not valid JSON." };
    }
    const parsedTiers = deserializeMintTiers(parsed);
    if (parsedTiers && parsedTiers.length > 0) {
      return {
        ok: false,
        message: "Tiered mint pricing is no longer supported — use one flat price per Genesis Pass for fair launch.",
      };
    }
  }

  if (!slugRegex.test(slug)) {
    return { ok: false, message: "Slug must be 3-64 chars: lowercase letters, numbers, hyphens." };
  }
  if (!name) return { ok: false, message: "Name is required." };
  if (!description) return { ok: false, message: "Description is required." };
  if (!bannerUrl || !logoUrl) {
    return { ok: false, message: "Add a banner and logo — upload images or paste HTTPS links." };
  }
  if (!isHttpsUrl(bannerUrl) || !isHttpsUrl(logoUrl)) {
    return { ok: false, message: "Banner and logo must be full https:// URLs." };
  }
  if (mintPriceLamports === null) {
    return { ok: false, message: "Mint price must be a number in SOL (e.g. 0.5)." };
  }

  if (!tokenName) return { ok: false, message: "Add a token name (e.g. Wire)." };
  if (!TOKEN_SYMBOL_RE.test(tokenSymbol)) {
    return { ok: false, message: "Token symbol must be 2–10 uppercase letters/numbers." };
  }

  const mintPriceSolNum = Number(mintPriceLamports) / 1_000_000_000;
  const policyError = validateLaunchEconomicsInputs({ supply, mintPriceSol: mintPriceSolNum });
  if (policyError) return { ok: false, message: explainLaunchEconomicsError(policyError) };

  const anchorMintPriceLamports = mintPriceLamports ?? BigInt(0);
  const anchorPriceLabel = priceLabel || `${mintPriceSol || "0"} ${quoteAsset === "USDC" ? "USDC" : "SOL"}`;

  const creatorTreasuryError = ensureSolanaAddress(creatorTreasury, "Creator wallet");
  if (creatorTreasuryError) return { ok: false, message: creatorTreasuryError };
  if (!platformTreasury) {
    return {
      ok: false,
      message:
        "This environment isn’t finished for publishing yet (platform wallet missing). Contact support if this persists.",
    };
  }
  const platformTreasuryError = ensureSolanaAddress(platformTreasury, "Platform treasury");
  if (platformTreasuryError) return { ok: false, message: platformTreasuryError };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("collections").insert({
    slug,
    name,
    tagline,
    description,
    banner_url: bannerUrl,
    logo_url: logoUrl,
    nft_gallery_urls: nftGalleryParsed,
    token_social_links: serializeTokenSocialLinks(tokenSocial),
    token_metadata_profile: serializeTokenMetadataProfile(tokenMetaProfileParsed),
    chain: "solana",
    creator_display: session.address,
    creator_wallet: session.address,
    // Always start "upcoming" for marketing rails. Public mint is allowed when
    // `alpha_vault` + `core_collection` exist (`canPublicMintGenesisPass`); lifecycle
    // authority is on-chain, not this status field.
    status: "upcoming",
    minted: 0,
    supply,
    price_label: anchorPriceLabel,
    mint_price_lamports: anchorMintPriceLamports.toString(),
    quote_asset: quoteAsset,
    mint_tiers: null,
    platform_fee_bps: platformFeeBps,
    creator_treasury: creatorTreasury || null,
    platform_treasury: platformTreasury || null,
    phase: phase || "Public mint",
    utilities,
    token_symbol: tokenSymbol,
    holder_reward_pct: holderRewardPct,
    nft_holder_share_bps: nftHolderShareBps,
    creator_reward_vesting_duration_slots: vestingSlots.value.toString(),
    creator_reward_claim_start_delay_slots: delaySlots.value.toString(),
    creator_reward_transfer_cooldown_slots: cooldownSlots.value.toString(),
    creator_reward_max_claim_per_epoch: maxClaimPerEpoch.value.toString(),
    creator_reward_incentive_share_bps: creatorRewardIncentiveShareBps,
    creator_reward_immutable_after_launch: creatorRewardImmutableAfterLaunch,
    creator_vesting_supply_pct: vestingPct,
    creator_vesting_cliff_months: vestingCliff,
    creator_vesting_period_months: vestingPeriod,
    token_holder_reward_pct: tokenHolderRewardPct,
    slice_b_pct: sliceBPct,
    slice_b_creator_share_pct: sliceBCreatorSharePct,
    is_published: true,
    project_page: projectPageForRow,
    accent_color: accentColorForRow,
    hero_layout: heroLayoutForRow,
    project_headline: projectHeadlineRaw || null,
    project_subhead: projectSubheadRaw || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  revalidatePath("/create");
  revalidatePath(`/launch/${slug}`);
  revalidatePath(`/mint/${slug}`);
  revalidatePath(`/project/${slug}`);
  return {
    ok: true,
    message: "Launch published as upcoming. Head to your launch page to deploy on-chain — mint opens automatically when deploy finishes.",
  };
}
