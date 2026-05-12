-- Creator profiles + verification
--
-- Public profile for each creator wallet. Created lazily on first touch
-- (e.g. when a creator deploys a launch). Verification is a manual,
-- platform-controlled flag — flipped via the admin route after the team
-- reviews twitter/discord/etc. We deliberately keep this off-chain because
-- on-chain attestation adds complexity we don't need at v1.

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  -- Solana wallet (base58) is the identity. One row per wallet.
  wallet TEXT PRIMARY KEY,

  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,

  -- Public handles. Stored without "@" or "https://".
  twitter_handle TEXT,
  discord_handle TEXT,
  website_url TEXT,

  -- Verification: TRUE only after manual review. The badge in the UI
  -- reads this flag.
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  -- Wallet (admin) that flipped the bit, for audit.
  verified_by TEXT,

  -- Aggregate counters maintained on the server side. These are
  -- denormalized for the public profile page so we don't recompute on
  -- every render. Background jobs / triggers can keep them in sync.
  launch_count INTEGER NOT NULL DEFAULT 0,
  total_holders_estimate INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_profiles_verified_idx
  ON public.creator_profiles (verified) WHERE verified = TRUE;

-- Lightweight trigger to keep updated_at fresh on writes.
CREATE OR REPLACE FUNCTION public.touch_creator_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS creator_profiles_updated_at_trg ON public.creator_profiles;
CREATE TRIGGER creator_profiles_updated_at_trg
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_creator_profiles_updated_at();
