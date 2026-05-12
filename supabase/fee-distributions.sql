-- Audit log of every claim + distribute event so creators (and we) can prove
-- the right amount went to the right wallets. One row per "distribute" call;
-- recipients are stored as a JSON array to keep the schema flat.

CREATE TABLE IF NOT EXISTS public.fee_distributions (
  id BIGSERIAL PRIMARY KEY,
  collection_slug TEXT NOT NULL REFERENCES public.collections(slug) ON DELETE CASCADE,

  -- "creator" = creator pulled their 2%; "platform" = our cron pulled the 1%.
  kind TEXT NOT NULL CHECK (kind IN ('creator', 'platform')),

  -- The wallet that signed the claim (creator's wallet OR our hot wallet).
  signer_wallet TEXT NOT NULL,

  -- Amount in lamports moved in the audited claim/distribute flow (on-chain source).
  claimed_quote_lamports NUMERIC(40, 0) NOT NULL DEFAULT 0,
  claimed_base_amount    NUMERIC(40, 0) NOT NULL DEFAULT 0,

  -- For creator distributions, this is the lamports sent to the creator's
  -- own wallet ((100-holder_reward_pct)% of claimed_quote_lamports).
  creator_share_lamports NUMERIC(40, 0) NOT NULL DEFAULT 0,
  -- For creator distributions, lamports redistributed to NFT holders.
  holder_share_lamports  NUMERIC(40, 0) NOT NULL DEFAULT 0,

  -- Snapshot of holders + per-holder amount paid (only for kind='creator').
  -- Each entry is { wallet: "...", lamports: "...", asset: "..." }.
  holder_payouts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Tx signatures: the claim, plus optional follow-up payout tx batches.
  claim_signature TEXT,
  payout_signatures TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Whatever the creator picked at distribution time (stored for audit even
  -- if they later change their mind on collections.holder_reward_pct).
  holder_reward_pct SMALLINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fee_distributions_slug_idx
  ON public.fee_distributions (collection_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS fee_distributions_kind_idx
  ON public.fee_distributions (kind, created_at DESC);
