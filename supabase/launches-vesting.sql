-- Creator vesting + token-reward additions.
--
-- 1. New per-launch vesting parameters (wired through launch deploy + Anchor;
--    Meteora Alpha Vault / DAMM v2 handle liquidity, not vesting storage here):
--      creator_vesting_supply_pct   — % of the 1B token supply locked for the
--                                     creator (0–50). 0 = no vesting.
--      creator_vesting_cliff_months — wait time after vault completes / trading activates before
--                                     waves start (0–24).
--      creator_vesting_period_months — total duration over which the locked
--                                     tokens release linearly (1–60).
--
-- 2. New per-launch holder-reward share for vested tokens:
--      token_holder_reward_pct      — % of each token-reward distribution
--                                     that goes to Genesis Pass holders
--                                     (0–100). The rest stays with creator.
--
-- 3. fee_distributions.kind gains 'token-reward' so the same audit table
--    tracks SOL fees AND token rewards in one place.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS creator_vesting_supply_pct SMALLINT
    NOT NULL DEFAULT 0
    CHECK (creator_vesting_supply_pct >= 0 AND creator_vesting_supply_pct <= 50);

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS creator_vesting_cliff_months SMALLINT
    NOT NULL DEFAULT 0
    CHECK (creator_vesting_cliff_months >= 0 AND creator_vesting_cliff_months <= 24);

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS creator_vesting_period_months SMALLINT
    NOT NULL DEFAULT 12
    CHECK (creator_vesting_period_months >= 1 AND creator_vesting_period_months <= 60);

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS token_holder_reward_pct SMALLINT
    NOT NULL DEFAULT 0
    CHECK (token_holder_reward_pct >= 0 AND token_holder_reward_pct <= 100);

-- Replace fee_distributions kind check to allow 'token-reward'.
ALTER TABLE public.fee_distributions
  DROP CONSTRAINT IF EXISTS fee_distributions_kind_check;
ALTER TABLE public.fee_distributions
  ADD CONSTRAINT fee_distributions_kind_check
  CHECK (kind IN ('creator', 'platform', 'token-reward'));

COMMENT ON COLUMN public.collections.creator_vesting_supply_pct IS
  '% of the 1B token supply locked for the creator and released linearly after curve migration (0-50).';
COMMENT ON COLUMN public.collections.creator_vesting_cliff_months IS
  'Months of cliff after migration before vesting waves start (0-24).';
COMMENT ON COLUMN public.collections.creator_vesting_period_months IS
  'Total months over which the locked supply releases (1-60).';
COMMENT ON COLUMN public.collections.token_holder_reward_pct IS
  '% of each token-reward distribution paid to Genesis Pass holders (0-100). Rest stays with creator.';
