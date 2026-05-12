-- Deploy intent: trading-tax holder skim (bps) + optional CreatorRewardConfig pacing (see docs/creator-reward-config-architecture.md).
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS nft_holder_share_bps smallint NOT NULL DEFAULT 0
    CHECK (nft_holder_share_bps >= 0 AND nft_holder_share_bps <= 10000),
  ADD COLUMN IF NOT EXISTS creator_reward_vesting_duration_slots text NOT NULL DEFAULT '216000',
  ADD COLUMN IF NOT EXISTS creator_reward_claim_start_delay_slots text NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS creator_reward_transfer_cooldown_slots text NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS creator_reward_max_claim_per_epoch text NOT NULL DEFAULT '18446744073709551615',
  ADD COLUMN IF NOT EXISTS creator_reward_incentive_share_bps smallint NOT NULL DEFAULT 0
    CHECK (creator_reward_incentive_share_bps >= 0 AND creator_reward_incentive_share_bps <= 10000),
  ADD COLUMN IF NOT EXISTS creator_reward_immutable_after_launch boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.collections.nft_holder_share_bps IS '0–10000: share of trading-tax creator leg routed to holder reward index (on-chain intent; see set_nft_holder_share_bps).';
COMMENT ON COLUMN public.collections.creator_reward_vesting_duration_slots IS 'u64 as decimal string: linear vesting window for optional claim pacing.';
COMMENT ON COLUMN public.collections.creator_reward_claim_start_delay_slots IS 'u64 as decimal string: slots after anchor before vesting clock starts.';
COMMENT ON COLUMN public.collections.creator_reward_transfer_cooldown_slots IS 'u64 as decimal string: minimum slots between holder claims when config is passed.';
COMMENT ON COLUMN public.collections.creator_reward_max_claim_per_epoch IS 'u64 as decimal string: max reward token units claimable per distribution epoch.';
COMMENT ON COLUMN public.collections.creator_reward_incentive_share_bps IS '0–10000: gates fund_creator_nft_incentives SPL pull from creator treasury into holder vault.';
COMMENT ON COLUMN public.collections.creator_reward_immutable_after_launch IS 'When true, on-chain updates blocked after lifecycle reaches trading-active (program rules).';
