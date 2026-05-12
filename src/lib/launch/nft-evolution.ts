/**
 * NFT evolution framework: milestones tied to **verifiable oracle inputs**
 * (vault progress, graduation, distributions), not raw price.
 *
 * Metaplex Core updates: perform via authorized updater (multi-sig in prod);
 * prefer numeric `evolutionLevel` on-chain or in this map + off-chain renderer.
 */

/** Ordered tiers for traits / URI selection. */
export const NFT_EVOLUTION_TIERS = ["genesis", "ignition", "orbit", "eclipse"] as const;
export type NftEvolutionTier = (typeof NFT_EVOLUTION_TIERS)[number];

/** Inputs workers resolve from chain + DB (no user-submitted “hype” scores). */
export type NftEvolutionOracleSnapshot = {
  /** 0–10000 = 0–100.00% */
  alphaVaultFillBps: number;
  /**
   * True **only** when an indexer reads `LaunchState == TRADING_ACTIVE` from the Anchor
   * program. **Never** set from `damm_pool` / `IS NOT NULL` / Supabase heuristics — those are
   * infra metadata and must not gate evolution.
   */
  tradingActive: boolean;
  /** Count of creator→holder distribution rows in lookback window. */
  holderDistributionEvents30d: number;
  /** Sustained unique holders (from snapshot job), not intraday wash. */
  holderCountEma: number;
  /** Slot time of last distribution (unix seconds). */
  lastDistributionAt?: number | null;
};

export type NftEvolutionMilestone = {
  id: string;
  tier: NftEvolutionTier;
  /** Minimum conditions (AND). */
  rules: {
    minVaultFillBps: number;
    minHolderDistributionEvents30d: number;
    minHolderCountEma: number;
    /** Requires `snap.tradingActive` from on-chain lifecycle (not DB cache). */
    requireTradingActive?: boolean;
  };
  /** Trait / metadata keys to set when milestone activates (renderer consumes). */
  traitPatch: Record<string, string | number>;
};

/**
 * Default ladder — tune per product; higher index = strictly stronger gates.
 * `resolveNftEvolutionTier` picks the **highest** milestone satisfied.
 */
export const DEFAULT_EVOLUTION_MILESTONES: NftEvolutionMilestone[] = [
  {
    id: "m0-genesis",
    tier: "genesis",
    rules: {
      minVaultFillBps: 0,
      minHolderDistributionEvents30d: 0,
      minHolderCountEma: 0,
    },
    traitPatch: { evolutionTier: "genesis", evolutionLevel: 0 },
  },
  {
    id: "m1-ignition",
    tier: "ignition",
    rules: {
      minVaultFillBps: 5000,
      minHolderDistributionEvents30d: 1,
      minHolderCountEma: 10,
    },
    traitPatch: { evolutionTier: "ignition", evolutionLevel: 1 },
  },
  {
    id: "m2-orbit",
    tier: "orbit",
    rules: {
      minVaultFillBps: 9000,
      minHolderDistributionEvents30d: 3,
      minHolderCountEma: 40,
    },
    traitPatch: { evolutionTier: "orbit", evolutionLevel: 2 },
  },
  {
    id: "m3-eclipse",
    tier: "eclipse",
    rules: {
      minVaultFillBps: 10000,
      minHolderDistributionEvents30d: 6,
      minHolderCountEma: 80,
      requireTradingActive: true,
    },
    traitPatch: { evolutionTier: "eclipse", evolutionLevel: 3 },
  },
];

function milestoneSatisfied(m: NftEvolutionMilestone, snap: NftEvolutionOracleSnapshot): boolean {
  if (snap.alphaVaultFillBps < m.rules.minVaultFillBps) return false;
  if (snap.holderDistributionEvents30d < m.rules.minHolderDistributionEvents30d) return false;
  if (snap.holderCountEma < m.rules.minHolderCountEma) return false;
  if (m.rules.requireTradingActive && !snap.tradingActive) return false;
  return true;
}

/** Resolve the strongest milestone; if none, returns first (genesis). */
export function resolveNftEvolutionMilestone(
  snap: NftEvolutionOracleSnapshot,
  milestones: NftEvolutionMilestone[] = DEFAULT_EVOLUTION_MILESTONES,
): NftEvolutionMilestone {
  let best = milestones[0]!;
  for (const m of milestones) {
    if (milestoneSatisfied(m, snap)) best = m;
  }
  return best;
}

export function resolveNftEvolutionTier(snap: NftEvolutionOracleSnapshot): NftEvolutionTier {
  return resolveNftEvolutionMilestone(snap).tier;
}

/**
 * Authorized Core metadata update path (call site checklist):
 * 1. Verify updater is collection update authority (or delegated program).
 * 2. Apply `traitPatch` from resolved milestone + fixed `launchSlug` / `asset` attrs.
 * 3. Batch updates in a job to amortize rent + RPC cost.
 */
export const CORE_METADATA_UPDATE_CHECKLIST = [
  "Verify collection update authority signer",
  "Merge traitPatch with immutable launch keys (slug, serial)",
  "Log tx signature + old/new tier for indexer idempotency",
] as const;
