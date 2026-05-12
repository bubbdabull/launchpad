-- App code selects collections.alpha_vault (creator dashboard, deploy, webhooks).
-- Previously lived only in supabase/collections-alpha-vault.sql; ensure all envs get the column.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS alpha_vault text;

COMMENT ON COLUMN public.collections.alpha_vault IS
  'Meteora Alpha Vault pubkey. When set with core_collection, mint uses vault deposit + Core.';
