-- Referral system
--
-- One row per (referrer → referred) link, written when a referred wallet
-- successfully mints a Genesis Pass. The capture flow is:
--   1) Visitor lands on /launch/[slug]?ref=<wallet> (or any page)
--   2) Server sets `lp_ref` cookie (90d) with the referrer wallet
--   3) On mint, we POST /api/referrals/record { slug, mint_signature }
--      and write a row here keyed on (referred_wallet, slug)
--
-- Payouts are tracked but NOT yet automated on-chain — the v1 platform
-- captures the data and surfaces a leaderboard. Splitting the genesis mint tax
-- (7% of mint price, launch-controller) with referrers is a follow-up wiring step in the
-- mint-tx builder; the schema is ready for it (see `paid_out_lamports`).

CREATE TABLE IF NOT EXISTS public.referrals (
  id BIGSERIAL PRIMARY KEY,

  -- Referrer's Solana wallet (base58). The "creator" of the referral link.
  referrer_wallet TEXT NOT NULL,
  -- The wallet that minted because of this link.
  referred_wallet TEXT NOT NULL,
  -- The collection slug that was minted (we attribute per-launch).
  collection_slug TEXT NOT NULL REFERENCES public.collections(slug) ON DELETE CASCADE,

  -- Mint tx that closed the loop. Optional in case we record a "click" too.
  mint_signature TEXT,

  -- The mint price the referred wallet paid (lamports). Used for leaderboard
  -- volume sorting and for computing the platform's owed payout.
  mint_price_lamports NUMERIC(40, 0) NOT NULL DEFAULT 0,

  -- How many lamports we've actually paid out to the referrer for this row.
  -- Stays 0 until the platform-fee splitter runs.
  paid_out_lamports NUMERIC(40, 0) NOT NULL DEFAULT 0,
  paid_out_signature TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A wallet can only be "referred" once per launch. Self-referral is filtered
  -- in the API, but we also enforce here as a safety net.
  CONSTRAINT no_self_referral CHECK (referrer_wallet <> referred_wallet),
  CONSTRAINT one_per_referred_per_launch UNIQUE (referred_wallet, collection_slug)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx
  ON public.referrals (referrer_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_collection_idx
  ON public.referrals (collection_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_unpaid_idx
  ON public.referrals (paid_out_lamports) WHERE paid_out_lamports = 0;
