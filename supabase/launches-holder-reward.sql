-- Per-launch split of the creator's trading-fee pot (off-chain bookkeeping vs on-chain claims).
-- 0 = 100% creator wallet, 100 = 100% NFT holders.
-- Default 50% mirrors NEXT_PUBLIC_PLATFORM_TRADING_DEFAULT_HOLDER_REWARD_PCT.
-- Distribution is recorded after the creator claims per Meteora + program rules.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS holder_reward_pct SMALLINT
    NOT NULL DEFAULT 50
    CHECK (holder_reward_pct >= 0 AND holder_reward_pct <= 100);

COMMENT ON COLUMN public.collections.holder_reward_pct IS
  'Percent of the creator''s trading-fee pot redistributed to Genesis Pass holders (0–100). Creator keeps the remainder.';
