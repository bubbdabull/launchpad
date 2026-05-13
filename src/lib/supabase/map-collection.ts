import { deserializeMintTiers } from "@/lib/launch/mint-tiers";
import { sanitizeProjectPageDoc } from "@/lib/launch/project-page";
import {
  parseTokenMetadataProfileJson,
  type TokenMetadataProfile,
} from "@/lib/launch/token-metadata-profile";
import type { TokenSocialLinks } from "@/lib/launch/token-social";
import type { TraitCollectionConfig } from "@/lib/nft-generation/types";
import type { ChainId, Collection, MintStatus } from "@/types/collection";
import type { GenesisPassNftConfig } from "@/types/genesis-pass-nft";

/** Row shape from `public.collections` (PostgREST). */
export type CollectionRow = {
  id: string;
  creator_id: string | null;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  banner_url: string;
  logo_url: string;
  chain: string;
  creator_display: string;
  status: string;
  minted: number;
  supply: number;
  price_label: string;
  phase: string;
  mint_price_lamports: string | number | null;
  /** SOL | USDC — Alpha Vault quote preference. */
  quote_asset?: string | null;
  platform_fee_bps: number | null;
  creator_treasury: string | null;
  platform_treasury: string | null;
  utilities: unknown;
  trending_rank: number | null;
  volume_24h: string | null;
  is_featured: boolean;
  is_published: boolean;

  /** Solana on-chain wiring (added in launches-extend migration). */
  token_mint: string | null;
  token_symbol: string | null;
  /** Meteora Alpha Vault pubkey for Pattern A mints (optional). */
  alpha_vault?: string | null;
  core_collection: string | null;
  /** Cached DAMM pool pubkey — infra only; never treat as LaunchState / lifecycle (see `Collection.dammPool`). */
  damm_pool: string | null;
  creator_wallet: string | null;
  holder_reward_pct: number | null;
  /** 0–10000 bps of trading-tax creator leg for holder index (deploy intent). */
  nft_holder_share_bps?: number | null;
  creator_reward_vesting_duration_slots?: string | null;
  creator_reward_claim_start_delay_slots?: string | null;
  creator_reward_transfer_cooldown_slots?: string | null;
  creator_reward_max_claim_per_epoch?: string | null;
  creator_reward_incentive_share_bps?: number | null;
  creator_reward_immutable_after_launch?: boolean | null;
  creator_vesting_supply_pct: number | null;
  creator_vesting_cliff_months: number | null;
  creator_vesting_period_months: number | null;
  token_holder_reward_pct: number | null;
  /** 0–10: percent of 1B project tokens in Slice B reserve. */
  slice_b_pct?: number | null;
  /** 0–100: within Slice B, creator vs holder share of that reserve. */
  slice_b_creator_share_pct?: number | null;
  mint_tiers: unknown;

  launched_at?: string | null;
  implied_apr_pct?: number | null;
  apr_updated_at?: string | null;
  volume_lamports_24h?: string | number | null;
  volume_lamports_total?: string | number | null;
  mints_last_hour?: number | null;
  holder_count?: number | null;
  category?: string | null;

  project_page?: unknown;
  accent_color?: string | null;
  hero_layout?: string | null;
  project_headline?: string | null;
  project_subhead?: string | null;

  nft_gallery_urls?: unknown;
  token_social_links?: unknown;
  token_metadata_profile?: unknown;
  /** Optional generative Genesis Pass config (JSON). */
  genesis_pass_config?: unknown;
};

function asChainId(_v: string): ChainId {
  return "solana";
}

function asMintStatus(v: string): MintStatus {
  if (v === "live" || v === "upcoming" || v === "sold_out") return v;
  return "upcoming";
}

function asUtilities(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asHttpsStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (/^https:\/\/.+/i.test(s)) out.push(s);
  }
  return out.length ? out : undefined;
}

function asTokenMetadataProfile(v: unknown): TokenMetadataProfile | undefined {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return undefined;
  const parsed = parseTokenMetadataProfileJson(JSON.stringify(v));
  if (!parsed || Object.keys(parsed).length === 0) return undefined;
  return parsed;
}

function asTokenSocialLinks(v: unknown): TokenSocialLinks | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const pick = (k: string): string | undefined => {
    const s = o[k];
    return typeof s === "string" && s.trim() ? s.trim() : undefined;
  };
  const links: TokenSocialLinks = {};
  const w = pick("website");
  const t = pick("twitter");
  const d = pick("discord");
  const tg = pick("telegram");
  if (w) links.website = w;
  if (t) links.twitter = t;
  if (d) links.discord = d;
  if (tg) links.telegram = tg;
  return Object.keys(links).length ? links : undefined;
}

function asBigInt(v: string | number | null | undefined): bigint | undefined {
  if (v == null) return undefined;
  try {
    return BigInt(v);
  } catch {
    return undefined;
  }
}

function asQuoteAsset(v: string | null | undefined): "SOL" | "USDC" | undefined {
  if (v === "USDC") return "USDC";
  if (v === "SOL") return "SOL";
  return undefined;
}

function asGenesisPassNftConfig(v: unknown): GenesisPassNftConfig | undefined {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const revealAt = typeof o.revealAt === "string" && o.revealAt.trim() ? o.revealAt.trim() : undefined;
  const placeholderImageUrl =
    typeof o.placeholderImageUrl === "string" && o.placeholderImageUrl.trim()
      ? o.placeholderImageUrl.trim()
      : undefined;
  const traitConfigUri =
    typeof o.traitConfigUri === "string" && /^https:\/\//i.test(o.traitConfigUri.trim())
      ? o.traitConfigUri.trim()
      : undefined;
  const rarityListingUrl =
    typeof o.rarityListingUrl === "string" && /^https:\/\//i.test(o.rarityListingUrl.trim())
      ? o.rarityListingUrl.trim()
      : undefined;
  const allowDynamicPostReveal = o.allowDynamicPostReveal === true ? true : undefined;
  let traitConfig: TraitCollectionConfig | undefined;
  if (o.traitConfig != null && typeof o.traitConfig === "object" && !Array.isArray(o.traitConfig)) {
    const tc = o.traitConfig as TraitCollectionConfig;
    if (tc.schemaVersion === 1 && Array.isArray(tc.layers)) traitConfig = tc;
  }
  if (
    !revealAt &&
    !placeholderImageUrl &&
    !traitConfigUri &&
    !traitConfig &&
    !rarityListingUrl &&
    allowDynamicPostReveal !== true
  ) {
    return undefined;
  }
  const out: GenesisPassNftConfig = {};
  if (revealAt) out.revealAt = revealAt;
  if (placeholderImageUrl) out.placeholderImageUrl = placeholderImageUrl;
  if (traitConfigUri) out.traitConfigUri = traitConfigUri;
  if (traitConfig) out.traitConfig = traitConfig;
  if (rarityListingUrl) out.rarityListingUrl = rarityListingUrl;
  if (allowDynamicPostReveal === true) out.allowDynamicPostReveal = true;
  return out;
}

export function rowToCollection(row: CollectionRow): Collection {
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    bannerUrl: row.banner_url,
    logoUrl: row.logo_url,
    chain: asChainId(row.chain),
    creator: row.creator_display,
    status: asMintStatus(row.status),
    minted: row.minted,
    supply: row.supply,
    priceLabel: row.price_label,
    mintPriceLamports: asBigInt(row.mint_price_lamports),
    quoteAsset: asQuoteAsset(row.quote_asset ?? undefined) ?? "SOL",
    phase: row.phase,
    utilities: asUtilities(row.utilities),
    trendingRank: row.trending_rank ?? undefined,
    volume24h: row.volume_24h ?? undefined,
    tokenMint: row.token_mint ?? undefined,
    tokenSymbol: row.token_symbol ?? undefined,
    alphaVault: row.alpha_vault ?? undefined,
    coreCollection: row.core_collection ?? undefined,
    dammPool: row.damm_pool ?? undefined,
    creatorWallet: row.creator_wallet ?? undefined,
    holderRewardPct: row.holder_reward_pct ?? undefined,
    nftHolderShareBps:
      row.nft_holder_share_bps != null
        ? Math.max(0, Math.min(10_000, Math.round(Number(row.nft_holder_share_bps))))
        : undefined,
    creatorRewardVestingDurationSlots: row.creator_reward_vesting_duration_slots?.trim() || undefined,
    creatorRewardClaimStartDelaySlots: row.creator_reward_claim_start_delay_slots?.trim() || undefined,
    creatorRewardTransferCooldownSlots: row.creator_reward_transfer_cooldown_slots?.trim() || undefined,
    creatorRewardMaxClaimPerEpoch: row.creator_reward_max_claim_per_epoch?.trim() || undefined,
    creatorRewardIncentiveShareBps:
      row.creator_reward_incentive_share_bps != null
        ? Math.max(0, Math.min(10_000, Math.round(Number(row.creator_reward_incentive_share_bps))))
        : undefined,
    creatorRewardImmutableAfterLaunch: row.creator_reward_immutable_after_launch ?? undefined,
    creatorVestingSupplyPct: row.creator_vesting_supply_pct ?? undefined,
    creatorVestingCliffMonths: row.creator_vesting_cliff_months ?? undefined,
    creatorVestingPeriodMonths: row.creator_vesting_period_months ?? undefined,
    tokenHolderRewardPct: row.token_holder_reward_pct ?? undefined,
    sliceBPct: row.slice_b_pct != null ? Math.max(0, Math.min(10, Math.round(Number(row.slice_b_pct)))) : undefined,
    sliceBCreatorSharePct:
      row.slice_b_creator_share_pct != null
        ? Math.max(0, Math.min(100, Math.round(Number(row.slice_b_creator_share_pct))))
        : undefined,
    mintTiers: deserializeMintTiers(row.mint_tiers) ?? undefined,
    launchedAt: row.launched_at ?? undefined,
    impliedAprPct: row.implied_apr_pct ?? undefined,
    mintsLastHour: row.mints_last_hour ?? undefined,
    holderCount: row.holder_count ?? undefined,
    volumeLamports24h: row.volume_lamports_24h != null ? String(row.volume_lamports_24h) : undefined,
    category: row.category ?? undefined,
    nftGalleryUrls: asHttpsStringArray(row.nft_gallery_urls),
    tokenSocialLinks: asTokenSocialLinks(row.token_social_links),
    tokenMetadataProfile: asTokenMetadataProfile(row.token_metadata_profile),
    projectPage: row.project_page ? sanitizeProjectPageDoc(row.project_page) : null,
    accentColor: row.accent_color ?? null,
    heroLayout:
      row.hero_layout === "minimal" || row.hero_layout === "split" || row.hero_layout === "classic"
        ? row.hero_layout
        : null,
    projectHeadline: row.project_headline ?? null,
    projectSubhead: row.project_subhead ?? null,
    genesisPassNft: asGenesisPassNftConfig(row.genesis_pass_config),
  };
}
