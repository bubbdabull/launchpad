-- Drop obsolete pre–Alpha-Vault pool/config columns and partial index from public.collections.
-- Safe after application code no longer selects or maps these fields.
-- Idempotent: uses IF EXISTS throughout.

-- Partial index from launches-extend.sql (curve graduation watcher).
DROP INDEX IF EXISTS public.collections_curve_progress_idx;

ALTER TABLE public.collections
  DROP COLUMN IF EXISTS curve_progress_bps,
  DROP COLUMN IF EXISTS dbc_pool,
  DROP COLUMN IF EXISTS dbc_config,
  DROP COLUMN IF EXISTS dbc_config_template;

-- Optional: legacy pool deploy signature column; unused in app.
ALTER TABLE public.collections
  DROP COLUMN IF EXISTS deploy_pool_signature;

-- EVM-era price column (see launches-extend.sql); app uses mint_price_lamports only.
ALTER TABLE public.collections
  DROP COLUMN IF EXISTS mint_price_wei;

-- Only when the column exists (older DBs may not have run alpha_vault migration yet).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collections' AND column_name = 'alpha_vault'
  ) THEN
    EXECUTE $c$
      COMMENT ON COLUMN public.collections.alpha_vault IS
        'Meteora Alpha Vault pubkey. When set with core_collection, mint uses vault deposit + Core.'
    $c$;
  END IF;
END $$;
