-- Optional Meteora Alpha Vault for Pattern A mints (fee + vault deposit + Core + memo in one tx).
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS alpha_vault text;

COMMENT ON COLUMN public.collections.alpha_vault IS
  'Meteora Alpha Vault pubkey. When set with core_collection, mint uses vault deposit + Core.';
