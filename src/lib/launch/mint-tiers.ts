/**
 * Mint-tier model.
 *
 * Two pricing models exist for a launch:
 *
 * 1. Flat — single `mint_price_lamports`. Every NFT mints for the same SOL.
 * 2. Tiered — an ordered list of tiers, each with `{name, quota, priceLamports}`.
 *    Tiers are sold sequentially from index 0 upward; the active tier at any
 *    moment is derived from the live minted count.
 *
 * The on-chain behavior is the same bundle shape — only the quote deposited to
 * the Alpha Vault per mint changes per tier.
 *
 * The **total vault raise cap** is the sum of (quota × price) across all tiers
 * when every NFT mints.
 */

import { LAUNCH_ECONOMICS_POLICY } from "./launch-economics-policy";

export type MintTier = {
  /** Display name shown to users, e.g. "Founders", "Early", "Public". */
  name: string;
  /** Number of NFTs mintable in this tier. */
  quota: number;
  /** Price per NFT during this tier (in lamports). */
  priceLamports: bigint;
};

/** Wire format for storage / API: BigInts serialized as decimal strings. */
export type MintTierWire = {
  name: string;
  quota: number;
  priceLamports: string;
};

export const MAX_TIERS = 6;

/** Coerce a raw JSONB row into typed `MintTier[]` (or null if not tiered). */
export function deserializeMintTiers(raw: unknown): MintTier[] | null {
  if (!raw) return null;
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return null;

  const out: MintTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const r = item as { name?: unknown; quota?: unknown; price_lamports?: unknown; priceLamports?: unknown };
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const quotaNum = typeof r.quota === "number" ? r.quota : Number(r.quota);
    const priceRaw = (r.price_lamports ?? r.priceLamports) as unknown;
    if (!name || !Number.isFinite(quotaNum) || quotaNum <= 0) return null;
    let price: bigint;
    try {
      price = BigInt(typeof priceRaw === "bigint" ? priceRaw : String(priceRaw ?? "0"));
    } catch {
      return null;
    }
    if (price < BigInt(0)) return null;
    out.push({ name, quota: Math.round(quotaNum), priceLamports: price });
  }
  return out;
}

/** Serialize for storage (BigInt → string) — JSONB-friendly. */
export function serializeMintTiers(tiers: MintTier[]): MintTierWire[] {
  return tiers.map((t) => ({
    name: t.name,
    quota: t.quota,
    priceLamports: t.priceLamports.toString(),
  }));
}

/** Sum of quotas across all tiers (must equal collection supply). */
export function totalTierQuota(tiers: MintTier[]): number {
  return tiers.reduce((s, t) => s + t.quota, 0);
}

/** Total SOL deposited to the Alpha Vault if every tier sells out. */
export function totalTierLamports(tiers: MintTier[]): bigint {
  return tiers.reduce((s, t) => s + t.priceLamports * BigInt(t.quota), BigInt(0));
}

/** Volume-weighted average mint price across all tiers (lamports). */
export function averageTierPriceLamports(tiers: MintTier[]): bigint {
  const total = totalTierQuota(tiers);
  if (total <= 0) return BigInt(0);
  return totalTierLamports(tiers) / BigInt(total);
}

export type ActiveTierInfo = {
  index: number;          // 0-based tier index currently minting
  tier: MintTier;
  soldInTier: number;     // count of NFTs already minted within THIS tier
  remainingInTier: number;// quota − soldInTier
  isLast: boolean;        // true if this is the final tier
  /** Cumulative quota at the END of this tier (handy for progress bars). */
  cumulativeQuotaAfter: number;
};

/**
 * Resolve the active tier given a live on-chain mint count.
 *
 * Returns `null` if the launch is fully sold out (mintedCount ≥ Σquota).
 */
export function getActiveTier(tiers: MintTier[], mintedCount: number): ActiveTierInfo | null {
  if (tiers.length === 0) return null;
  let cumulative = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const start = cumulative;
    cumulative += t.quota;
    if (mintedCount < cumulative) {
      return {
        index: i,
        tier: t,
        soldInTier: Math.max(0, mintedCount - start),
        remainingInTier: cumulative - mintedCount,
        isLast: i === tiers.length - 1,
        cumulativeQuotaAfter: cumulative,
      };
    }
  }
  return null; // sold out
}

export type TierValidationError =
  | { code: "no_tiers" }
  | { code: "too_many_tiers" }
  | { code: "quota_mismatch"; expected: number; actual: number }
  | { code: "tier_quota_invalid"; index: number }
  | { code: "tier_price_low"; index: number; minSol: number }
  | { code: "tier_price_high"; index: number; maxSol: number }
  | { code: "tier_price_not_increasing"; index: number }
  | { code: "graduation_high"; targetSol: number; maxSol: number };

/**
 * Validate a tier list against launch economics bounds and supply.
 *
 * `requireMonotonic = true` enforces that tier prices never decrease
 * (Tier N+1 ≥ Tier N). Default true; set false to allow descending tiers
 * (e.g. promo tiers later in the drop). Most launches keep monotonic.
 */
export function validateMintTiers(input: {
  tiers: MintTier[];
  totalSupply: number;
  requireMonotonic?: boolean;
}): TierValidationError | null {
  const { tiers, totalSupply, requireMonotonic = true } = input;

  if (!tiers.length) return { code: "no_tiers" };
  if (tiers.length > MAX_TIERS) return { code: "too_many_tiers" };

  const minPriceLamports = BigInt(Math.round(LAUNCH_ECONOMICS_POLICY.MIN_MINT_PRICE_SOL * 1_000_000_000));
  const maxPriceLamports = BigInt(Math.round(LAUNCH_ECONOMICS_POLICY.MAX_MINT_PRICE_SOL * 1_000_000_000));

  let prev = BigInt(0);
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!Number.isFinite(t.quota) || t.quota <= 0) {
      return { code: "tier_quota_invalid", index: i };
    }
    if (t.priceLamports < minPriceLamports) {
      return { code: "tier_price_low", index: i, minSol: LAUNCH_ECONOMICS_POLICY.MIN_MINT_PRICE_SOL };
    }
    if (t.priceLamports > maxPriceLamports) {
      return { code: "tier_price_high", index: i, maxSol: LAUNCH_ECONOMICS_POLICY.MAX_MINT_PRICE_SOL };
    }
    if (requireMonotonic && i > 0 && t.priceLamports < prev) {
      return { code: "tier_price_not_increasing", index: i };
    }
    prev = t.priceLamports;
  }

  const sumQuota = totalTierQuota(tiers);
  if (sumQuota !== totalSupply) {
    return { code: "quota_mismatch", expected: totalSupply, actual: sumQuota };
  }

  const targetLamports = totalTierLamports(tiers);
  const targetSol = Number(targetLamports) / 1_000_000_000;
  if (targetSol > LAUNCH_ECONOMICS_POLICY.MAX_VAULT_RAISE_SOL) {
    return {
      code: "graduation_high",
      targetSol,
      maxSol: LAUNCH_ECONOMICS_POLICY.MAX_VAULT_RAISE_SOL,
    };
  }
  return null;
}

export function explainTierError(err: TierValidationError): string {
  switch (err.code) {
    case "no_tiers":
      return "Add at least one mint tier.";
    case "too_many_tiers":
      return `A launch can have at most ${MAX_TIERS} tiers.`;
    case "quota_mismatch":
      return `Tier quotas total ${err.actual.toLocaleString()} but NFT supply is ${err.expected.toLocaleString()}. They must match.`;
    case "tier_quota_invalid":
      return `Tier ${err.index + 1}: quota must be a positive number.`;
    case "tier_price_low":
      return `Tier ${err.index + 1}: price must be at least ${err.minSol} SOL.`;
    case "tier_price_high":
      return `Tier ${err.index + 1}: price can't exceed ${err.maxSol} SOL.`;
    case "tier_price_not_increasing":
      return `Tier ${err.index + 1}: price must be greater than or equal to the previous tier (use ascending pricing).`;
    case "graduation_high":
      return `Total raise (${err.targetSol.toFixed(2)} SOL across all tiers) can't exceed ${err.maxSol.toLocaleString()} SOL.`;
  }
}

/**
 * Auto-suggest a tier structure given supply + a baseline mint price.
 *
 * Default: 4 tiers, ascending prices at 1×, 1.5×, 2×, 3× the baseline,
 * each holding ~25% of supply. Adjusts the last tier's quota to absorb
 * any rounding so the sum equals exactly `supply`.
 */
export function autoSuggestTiers(input: {
  supply: number;
  baselinePriceLamports: bigint;
}): MintTier[] {
  const ratios = [1, 1.5, 2, 3];
  const names = ["Founders", "Early", "Public", "Final"];
  const perTier = Math.floor(input.supply / ratios.length);
  const remainder = input.supply - perTier * ratios.length;

  return ratios.map((r, i) => {
    const isLast = i === ratios.length - 1;
    const quota = isLast ? perTier + remainder : perTier;
    // Multiply lamports by ratio with safe BigInt math (×1000 / 1000).
    const ratioInt = BigInt(Math.round(r * 1000));
    const priceLamports = (input.baselinePriceLamports * ratioInt) / BigInt(1000);
    return { name: names[i], quota, priceLamports };
  });
}
