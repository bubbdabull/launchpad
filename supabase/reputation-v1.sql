-- Wallet reputation v1: slow signals + hysteresis-friendly cache.
-- Populated by workers from distributions, claims, and (later) NFT hold telemetry.

CREATE TABLE IF NOT EXISTS public.wallet_activity_rollups (
  wallet TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  distinct_launches_minted INTEGER NOT NULL DEFAULT 0,
  claim_event_count INTEGER NOT NULL DEFAULT 0,
  distribution_recipient_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_claim_at TIMESTAMPTZ,
  sybil_cluster_hint TEXT
);

CREATE INDEX IF NOT EXISTS wallet_activity_rollups_updated_idx
  ON public.wallet_activity_rollups (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.wallet_rep_v1_cache (
  wallet TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('dust', 'iron', 'gold', 'legend')),
  raw_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  methodology_version TEXT NOT NULL DEFAULT 'rep-v1',
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_rep_v1_cache_tier_idx
  ON public.wallet_rep_v1_cache (tier, computed_at DESC);
