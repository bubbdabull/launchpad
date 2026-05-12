/**
 * Versioned trending / discovery signal methodology.
 * Keep in sync with `ecosystem_signal_specs` seed in `supabase/ecosystem-signals-and-indexer.sql`.
 */

export const TRENDING_SPEC_ID = "trending" as const;
export const TRENDING_SPEC_VERSION = 1 as const;

export const SIGNAL_METHODOLOGY = {
  specId: TRENDING_SPEC_ID,
  version: TRENDING_SPEC_VERSION,
  title: "Trending & momentum signals (v1)",
  principles: [
    "Rank launches using diversified activity signals, not raw traded volume.",
    "Cap per-wallet contribution on short windows to reduce wash-adjacent gaming.",
    "Prefer medians / trimmed statistics in workers; expose methodology version on every snapshot.",
    "Separate ephemeral 'hot now' rails from slow 'hall of fame' scores in product UX.",
  ],
  inputs: {
    unique_buyers_24h: { weight: 0.25, capPerWallet: 1 },
    returning_claim_wallets_7d: { weight: 0.2, capPerWallet: 1 },
    secondary_unique_takers_24h: { weight: 0.15, capPerWallet: 1 },
    holder_distribution_events_30d: { weight: 0.2 },
    median_hold_hours_before_resale: { weight: 0.1, direction: "higher_better" as const },
    mints_last_hour_normalized: { weight: 0.1 },
  },
  aggregation: "weighted_sum_with_per_wallet_caps_then_optional_trim",
  explicitNonSignals: [
    "Raw pool or token volume without counterparty diversity is not a ranking input.",
    "PnL and wallet balances are never reputation inputs (see reputation v1).",
  ],
} as const;
