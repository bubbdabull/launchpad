/**
 * Reputation v1 — **slow signals only** (no PnL, no raw volume).
 * Tiers use hysteresis bands so wallets cannot oscillate for gaming.
 *
 * **Never** use these scores for token allocation or payouts — allocation is on-chain only.
 */

export const REP_METHODOLOGY_VERSION = "rep-v1" as const;

export type RepTierV1 = "dust" | "iron" | "gold" | "legend";

/** Inputs workers derive from `wallet_activity_rollups` + claim indexers. */
export type RepV1Inputs = {
  distinctLaunchesMinted: number;
  claimEventCount: number;
  distributionRecipientCount: number;
  /** Optional soft cap: max economic weight from one cluster id. */
  sybilClusterPenalty?: number;
};

export type RepV1Result = {
  tier: RepTierV1;
  rawScore: number;
  methodologyVersion: typeof REP_METHODOLOGY_VERSION;
  inputs: RepV1Inputs;
};

/** Raw score before hysteresis (transparent linear blend). */
export function repRawScore(i: RepV1Inputs): number {
  const cluster = Math.min(1, Math.max(0, 1 - (i.sybilClusterPenalty ?? 0)));
  return (
    (2.0 * Math.log1p(i.distinctLaunchesMinted) +
      1.2 * Math.log1p(i.claimEventCount) +
      1.5 * Math.log1p(i.distributionRecipientCount)) *
    cluster
  );
}

/** Tier thresholds on raw score (tune from data). */
const TIER_THRESHOLDS: { tier: RepTierV1; min: number }[] = [
  { tier: "legend", min: 8.5 },
  { tier: "gold", min: 5.5 },
  { tier: "iron", min: 2.5 },
  { tier: "dust", min: 0 },
];

export function repTierFromRawScore(raw: number): RepTierV1 {
  for (const t of TIER_THRESHOLDS) {
    if (raw >= t.min) return t.tier;
  }
  return "dust";
}

/**
 * Hysteresis: moving **up** requires `upMargin` extra raw score; moving **down** requires
 * dropping `downMargin` below the band edge. Prevents edge flicker.
 */
export function applyRepTierHysteresis(
  previousTier: RepTierV1 | null,
  raw: number,
  opts?: { upMargin?: number; downMargin?: number },
): RepTierV1 {
  const upMargin = opts?.upMargin ?? 0.35;
  const downMargin = opts?.downMargin ?? 0.35;
  const naive = repTierFromRawScore(raw);
  if (!previousTier) return naive;

  const order: RepTierV1[] = ["dust", "iron", "gold", "legend"];
  const prevIdx = order.indexOf(previousTier);
  const nextIdx = order.indexOf(naive);
  if (nextIdx === prevIdx) return previousTier;
  if (nextIdx > prevIdx) {
    const need = repTierFromRawScore(raw - upMargin);
    return order.indexOf(need) >= nextIdx ? naive : previousTier;
  }
  const needDown = repTierFromRawScore(raw + downMargin);
  return order.indexOf(needDown) <= nextIdx ? naive : previousTier;
}

export function computeRepV1(
  inputs: RepV1Inputs,
  previousTier?: RepTierV1 | null,
): RepV1Result {
  const raw = repRawScore(inputs);
  const tier = applyRepTierHysteresis(previousTier ?? null, raw);
  return {
    tier,
    rawScore: raw,
    methodologyVersion: REP_METHODOLOGY_VERSION,
    inputs,
  };
}
