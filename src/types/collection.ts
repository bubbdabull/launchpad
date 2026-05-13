import type { MintTier } from "@/lib/launch/mint-tiers";
import type { ProjectPageDoc } from "@/lib/launch/project-page";
import type { GenesisPassNftConfig } from "@/types/genesis-pass-nft";
import type { TokenMetadataProfile } from "@/lib/launch/token-metadata-profile";
import type { TokenSocialLinks } from "@/lib/launch/token-social";

export type { MintTier } from "@/lib/launch/mint-tiers";
export type { TokenMetadataProfile } from "@/lib/launch/token-metadata-profile";
export type { TokenSocialLinks } from "@/lib/launch/token-social";

export type ChainId = "solana";

export type MintStatus = "live" | "upcoming" | "sold_out";

/** A creator launch on Solana: Genesis Pass (Metaplex Core) + Meteora Alpha Vault primary sales. */
export type Collection = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  bannerUrl: string;
  logoUrl: string;
  chain: ChainId;
  creator: string;
  status: MintStatus;
  minted: number;
  supply: number;
  /** Display label for the NFT mint price, e.g. "0.5 SOL". */
  priceLabel: string;
  /** Mint price for the Genesis Pass NFT, in lamports. */
  mintPriceLamports?: bigint;
  /** Primary-sale quote: SOL or USDC (stored for economics + future vault wiring). */
  quoteAsset?: "SOL" | "USDC";
  phase: string;
  utilities: string[];
  trendingRank?: number;
  volume24h?: string;

  /** SPL token mint (from Meteora / your setup) when known. */
  tokenMint?: string;
  /** Meteora Alpha Vault — required for Genesis mint on this launchpad. */
  alphaVault?: string;
  /** Metaplex Core collection mint (the "collection NFT"). */
  coreCollection?: string;
  /**
   * Optional generative Genesis Pass pipeline (traits, reveal timing, placeholder art).
   * **Cosmetic / metadata only** — never used for claim math or holder entitlements.
   */
  genesisPassNft?: GenesisPassNftConfig;
  /**
   * **Infrastructure metadata only** — cached Meteora DAMM v2 pool pubkey for routing,
   * explorers, and copy-paste UX. It is **not** a lifecycle signal: do not use presence,
   * `IS NOT NULL`, or any derived rule for rewards, claims, allocation, or NFT evolution.
   * Lifecycle authority is **only** `LaunchState` on the Anchor program.
   */
  dammPool?: string;
  /** Token symbol, e.g. "WIRE". */
  tokenSymbol?: string;
  /** Creator's Solana pubkey — used to gate the deploy-on-chain panel. */
  creatorWallet?: string;
  /**
   * Legacy display / docs only — **not** enforced for payouts in the app. Holder splits must be
   * on-chain. 0 = 100% creator, 100 = 100% holders (historical meaning).
   */
  holderRewardPct?: number;

  /**
   * 0–10000 basis points: intended share of the **trading-tax creator leg** routed to the holder
   * reward index at deploy (`set_nft_holder_share_bps`). Usually aligned with `holderRewardPct`
   * × 100. Display / deploy intent only — L1 truth is on-chain `LaunchMonetization`.
   */
  nftHolderShareBps?: number;

  /** `CreatorRewardConfig.vesting_duration_slots` (u64) as decimal string for deploy builders. */
  creatorRewardVestingDurationSlots?: string;
  /** `claim_start_delay_slots` (u64). */
  creatorRewardClaimStartDelaySlots?: string;
  /** `transfer_cooldown_slots` (u64). */
  creatorRewardTransferCooldownSlots?: string;
  /** `max_claim_per_epoch` (u64), reward token base units. */
  creatorRewardMaxClaimPerEpoch?: string;
  /**
   * 0–10000 bps: share used to gate `fund_creator_nft_incentives` (creator treasury → holder vault).
   */
  creatorRewardIncentiveShareBps?: number;
  /** When true, program blocks config updates after trading is active (see on-chain constraints). */
  creatorRewardImmutableAfterLaunch?: boolean;

  /** % of total token supply locked for the creator (0–50). 0 = no vesting. */
  creatorVestingSupplyPct?: number;
  /** Cliff before vesting waves start, in months (0–24). */
  creatorVestingCliffMonths?: number;
  /** Total vesting duration, in months (1–60). One wave per month. */
  creatorVestingPeriodMonths?: number;
  /** % of every token-reward distribution paid to Genesis Pass holders (0–100). */
  tokenHolderRewardPct?: number;

  /**
   * Slice B: percent of the fixed 1B project SPL held out for creator + Genesis holders (0–10).
   * Remainder is Slice A (vault / LP / program path). Immutable after Alpha Vault is linked.
   */
  sliceBPct?: number;
  /** Within Slice B only: percent of that reserve for the creator vs holders (0–100). */
  sliceBCreatorSharePct?: number;

  /**
   * Optional tier-based mint pricing. When set, every NFT in tier `i` mints at
   * `tiers[i].priceLamports`. Tiers fill in order. When undefined, the launch
   * uses flat pricing via `mintPriceLamports`.
   */
  mintTiers?: MintTier[];

  /** Populated on home grid when the collection has at least one active store product. */
  hasStorefront?: boolean;

  /** ISO timestamp the launch went live (status -> 'live'). */
  launchedAt?: string;
  /** Cached "implied 7d APR" %, populated from /api/launches/[slug]/yield. */
  impliedAprPct?: number;
  /** Number of mints in the last 60 minutes. Drives "filling fast" sort. */
  mintsLastHour?: number;
  /** Last-known holder count for the collection (Helius DAS snapshot). */
  holderCount?: number;
  /** 24h trading volume in lamports (refreshed by background job). */
  volumeLamports24h?: string;
  /** Free-text category tag for discovery filters: "memes", "art", etc. */
  category?: string;
  /** Whether the creator wallet has been verified by the platform. */
  creatorVerified?: boolean;
  /** Display name from the creator's profile, when set. */
  creatorDisplayName?: string;

  /**
   * Extra stills / variants (https image URLs). Shown in token + NFT metadata
   * `properties.files` alongside logo and banner.
   */
  nftGalleryUrls?: string[];
  /** Optional https links surfaced in on-chain metadata JSON. */
  tokenSocialLinks?: TokenSocialLinks;
  /**
   * Extra long-form copy + optional GitHub / YouTube / TikTok URLs merged into
   * token + collection + asset metadata JSON for richer explorer surfaces.
   */
  tokenMetadataProfile?: TokenMetadataProfile;

  /** Custom project-page block document. Null/undefined = use defaults. */
  projectPage?: ProjectPageDoc | null;
  /** Hex color (#7CFFB2) overriding the platform accent on /project/[slug]. */
  accentColor?: string | null;
  /** Hero layout variant for /project/[slug]: classic | minimal | split. */
  heroLayout?: "classic" | "minimal" | "split" | null;
  /** Optional headline that overrides `name` on the project page. */
  projectHeadline?: string | null;
  /** Optional subhead that overrides `tagline` on the project page. */
  projectSubhead?: string | null;
};
