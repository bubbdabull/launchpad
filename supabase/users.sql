-- ============================================================================
--  Generic users table
-- ============================================================================
--  Keyed by Solana wallet address (the same identifier we use everywhere
--  else). Stores Privy identity metadata when a user signed up via Privy
--  (email, social handles, Privy user id), and a few denormalized counters
--  we update from server actions / webhooks.
--
--  Distinct from `creator_profiles`:
--    - Every authenticated user gets a row here (creators, buyers, holders).
--    - `creator_profiles` is the public-facing creator card + verification.
--
--  Privy users get rows when they first hit `/api/auth/siws/verify`. Phantom
--  users get a row at the same point. Privy-specific fields (email,
--  privy_user_id, linked_socials) stay null for Phantom-only users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  wallet            TEXT PRIMARY KEY,

  -- Privy identity (null for non-Privy users)
  privy_user_id     TEXT UNIQUE,
  email             TEXT,
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Flexible blob for linked social accounts. Shape mirrors Privy's
  -- `user.linkedAccounts`:
  --   { google?: {sub, email}, twitter?: {handle, sub}, apple?: {...}, ... }
  linked_socials    JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Source attribution. Useful for funnel analytics ("how many signups came
  -- from email vs Phantom?"). One of: 'email' | 'google' | 'apple' |
  -- 'twitter' | 'discord' | 'wallet' | 'other'.
  signup_method     TEXT,

  -- True iff this wallet is a Privy-provisioned embedded wallet (vs an
  -- external wallet a user linked through Privy or connected via
  -- wallet-adapter directly). Helpful when deciding whether to show
  -- "Add SOL with card" or "Take self-custody" CTAs.
  is_embedded       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Marketing / lifecycle preferences
  notify_email      BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx
  ON public.users ((LOWER(email)))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_privy_user_idx
  ON public.users (privy_user_id)
  WHERE privy_user_id IS NOT NULL;

-- Auto-update `updated_at` on row mutation.
CREATE OR REPLACE FUNCTION public.touch_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at_trg ON public.users;
CREATE TRIGGER users_updated_at_trg
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_users_updated_at();
