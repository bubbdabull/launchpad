-- Tier-based mint pricing.
--
-- `mint_tiers` is an ordered JSONB array of tier definitions. NULL = the
-- launch uses the existing flat single-price model (back-compat).
--
-- Schema (validated app-side, not by SQL — JSONB is intentionally flexible):
--   [
--     { "name": "Founders", "quota": 250, "price_lamports": "200000000" },
--     { "name": "Early",    "quota": 250, "price_lamports": "300000000" },
--     ...
--   ]
--
-- Constraints enforced in app code (createDraftCollection action):
--   - 1..6 tiers
--   - sum(quota) == collections.supply
--   - each tier price within CURVE_POLICY price bounds
--   - sum(quota * price_lamports) >= MIN_GRADUATION_SOL
--
-- The active tier at any moment is derived from the live on-chain mint count:
--   tier_index = first i where Σ(quota[0..i]) > minted_count.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS mint_tiers JSONB;

COMMENT ON COLUMN public.collections.mint_tiers IS
  'Optional ordered array of mint tiers [{name, quota, price_lamports}]. NULL = flat single-price model using mint_price_lamports.';
