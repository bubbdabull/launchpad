-- Primary-sale quote asset for Alpha Vault economics (UI + future Meteora wiring).
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS quote_asset text NOT NULL DEFAULT 'SOL';

COMMENT ON COLUMN public.collections.quote_asset IS
  'Quote side for vault primary sales: SOL or USDC (app preference; on-chain wiring may still be SOL-only until upgraded).';
