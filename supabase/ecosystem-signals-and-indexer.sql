-- Versioned trending / signal methodology + raw program events for indexers.
-- Apply after `collections` exists (references collection_slug).

-- Published spec versions (human + machine readable).
CREATE TABLE IF NOT EXISTS public.ecosystem_signal_specs (
  spec_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  methodology_url TEXT,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (spec_id, version)
);

-- Point-in-time derived inputs + score per launch (computed by cron / worker).
CREATE TABLE IF NOT EXISTS public.launch_signal_snapshots (
  id BIGSERIAL PRIMARY KEY,
  collection_slug TEXT NOT NULL REFERENCES public.collections (slug) ON DELETE CASCADE,
  spec_id TEXT NOT NULL,
  spec_version INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  derived_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  rank_hint INTEGER,
  FOREIGN KEY (spec_id, spec_version) REFERENCES public.ecosystem_signal_specs (spec_id, version)
);

CREATE INDEX IF NOT EXISTS launch_signal_snapshots_slug_time_idx
  ON public.launch_signal_snapshots (collection_slug, computed_at DESC);

CREATE INDEX IF NOT EXISTS launch_signal_snapshots_score_idx
  ON public.launch_signal_snapshots (spec_id, spec_version, derived_score DESC);

-- Idempotent upsert key for Anchor / custom program log events.
CREATE TABLE IF NOT EXISTS public.chain_program_events (
  id BIGSERIAL PRIMARY KEY,
  signature TEXT NOT NULL,
  event_index SMALLINT NOT NULL DEFAULT 0,
  slot BIGINT,
  program_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  collection_slug TEXT REFERENCES public.collections (slug) ON DELETE SET NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signature, event_index, event_name)
);

CREATE INDEX IF NOT EXISTS chain_program_events_program_idx
  ON public.chain_program_events (program_id, inserted_at DESC);

CREATE INDEX IF NOT EXISTS chain_program_events_slug_idx
  ON public.chain_program_events (collection_slug, inserted_at DESC);

-- Bootstrap current trending spec (tune weights off-line; version bumps are explicit).
INSERT INTO public.ecosystem_signal_specs (spec_id, version, methodology_url, spec)
VALUES (
  'trending',
  1,
  '/api/ecosystem/signals-methodology',
  '{
    "name": "trending-v1",
    "inputs": {
      "unique_buyers_24h": { "weight": 0.25, "cap_per_wallet": 1 },
      "returning_claim_wallets_7d": { "weight": 0.2, "cap_per_wallet": 1 },
      "secondary_unique_takers_24h": { "weight": 0.15, "cap_per_wallet": 1 },
      "holder_distribution_events_30d": { "weight": 0.2 },
      "median_hold_hours_before_resale": { "weight": 0.1, "direction": "higher_better" },
      "mints_last_hour_normalized": { "weight": 0.1 }
    },
    "aggregation": "weighted_sum_then_trimmed",
    "anti_wash": [
      "no_raw_volume_term",
      "per_wallet_caps_on_short_windows",
      "median_and_trimmed_means_preferred_in_workers"
    ],
    "notes": "Workers compute raw_inputs from Helius + internal tables; this row is the contract."
  }'::jsonb
)
ON CONFLICT (spec_id, version) DO NOTHING;
