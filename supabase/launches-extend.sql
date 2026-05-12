-- Adds Solana / Meteora / Metaplex columns to the existing `collections` table.
-- Safe to run multiple times: every ALTER uses IF NOT EXISTS.

-- 1. Pricing in lamports (replaces wei). Keep mint_price_wei around for now;
--    the new code path only reads/writes mint_price_lamports.
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS mint_price_lamports NUMERIC(78,0);

-- 2. On-chain wiring for the paired Solana launch.
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS token_mint TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS token_symbol TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS core_collection TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS damm_pool TEXT;

-- 3. Lifecycle (e.g. LaunchState.TRADING_ACTIVE) is not stored here — add a
--    dedicated column only when an indexer mirrors on-chain state strictly.

-- 4. Force chain to 'solana' on every new insert from the app.
--    Existing rows remain whatever they were; mapper coerces to 'solana' on read.
DO $$ BEGIN
  ALTER TABLE public.collections ALTER COLUMN chain SET DEFAULT 'solana';
EXCEPTION WHEN others THEN NULL; END $$;

-- 5. Drop EVM-only columns that are no longer used. Kept as a no-op block —
--    uncomment when you've confirmed no historical reads depend on them.
--
-- ALTER TABLE public.collections DROP COLUMN IF EXISTS burn_collection_address;
-- ALTER TABLE public.collections DROP COLUMN IF EXISTS mint_collection_address;
-- ALTER TABLE public.collections DROP COLUMN IF EXISTS reward_treasury;
--
-- mint_price_wei removed via supabase migration dated 20260210120000 (collections cleanup).
