-- Remove ambiguous lifecycle flags. `graduated` was not wired to on-chain
-- LaunchState.TRADING_ACTIVE; do not use DB booleans as proxies.
-- Discovery may filter on cached `damm_pool` only (structural), not lifecycle.

DROP INDEX IF EXISTS public.collections_graduated_at_idx;

ALTER TABLE public.collections
  DROP COLUMN IF EXISTS graduated_at,
  DROP COLUMN IF EXISTS graduated;

ALTER TABLE public.creator_profiles
  DROP COLUMN IF EXISTS graduated_count;
