//! On-chain monetization: platform fee config, per-launch extension, holder reward index model,
//! genesis mint tax, and **DAMM trading tax** settlement. **Meteora DAMM remains the execution venue**
//! — fees land in the launch PDA fee buffer; `collect_platform_fee` derives the 3% tax from
//! `trade_amount`, splits 20%/80% of `tax` (platform / creator leg), optionally routes part of the
//! creator leg to the holder reward index, and emits indexing-only events.
//!
//! ## Transfer taxes (`buy_tax_bps`, `sell_tax_bps`, `transfer_tax_bps`)
//!
//! **Vanilla SPL Token** has no global transfer hook: these fields exist for **Token-2022 transfer-fee
//! extensions**, **program-controlled swap paths** (e.g. wrapped CPI routers), or **custom transfer
//! instructions** that opt into this program. They do **not** imply universal taxation of arbitrary
//! SPL user-wallet transfers.

use anchor_lang::prelude::*;

use crate::LaunchError;

/// Meteora CP AMM (DAMM v2) program id — must match `@meteora-ag/cp-amm-sdk` deployment.
pub const METEORA_CP_AMM_PROGRAM_ID: Pubkey =
    pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");

/// Immutable global platform receiver for **all** platform-side SPL (mint tax platform leg,
/// DAMM platform splits, launch fees, etc.).
pub const CANONICAL_PLATFORM_WALLET: Pubkey =
    pubkey!("DZM5SUFNThmzarZzKiJouwxh1XZtSstwbnN2F4vNCz3k");

/// Genesis mint tax: 7% of `mint_price` (on top of base price in the outer payment).
pub const GENESIS_MINT_TAX_BPS: u64 = 700;
pub const CREATOR_SHARE_OF_MINT_TAX_BPS: u64 = 2_000;
pub const MINT_TAX_SPLIT_DENOM_BPS: u64 = 10_000;

/// DAMM v2 trading tax: `tax = trade_amount * 300 / 10_000` (3%).
pub const TRADING_TAX_BPS: u64 = 300;
/// Of `tax`: platform receives this bps **floored**; remainder is the creator leg (80% nominal).
pub const TRADING_TAX_PLATFORM_LEG_BPS: u64 = 2_000;

pub const MAX_TAX_BPS: u16 = 1000;
pub const BPS_DENOMINATOR: u64 = 10_000;
/// Fixed-point scale for `cumulative_reward_per_share` (u128).
pub const REWARD_INDEX_PRECISION: u128 = 1_000_000_000_000;

// ── accounts ───────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct PlatformFeeConfig {
    pub authority: Pubkey,
    pub platform_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub nft_holder_fee_bps: u16,
    pub burn_fee_bps: u16,
    /// **Immutable** after init — always `CANONICAL_PLATFORM_WALLET`.
    pub platform_wallet: Pubkey,
    pub burn_treasury: Pubkey,
    pub fee_token_mint: Pubkey,
    pub paused: u8,
    pub version: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LaunchMonetization {
    /// Mirrors `LaunchState.key()` for indexers.
    pub launch: Pubkey,
    pub buy_tax_bps: u16,
    pub sell_tax_bps: u16,
    pub transfer_tax_bps: u16,
    pub tax_enabled: u8,
    pub damm_pool: Pubkey,
    pub reward_mint: Pubkey,
    /// Sum of `MintReceipt.allocation` units registered via `register_monetization_share`.
    pub total_share_units: u128,
    pub creator_treasury_override: Pubkey,
    /// Bps (0–10_000) of the **trading-tax creator leg** routed to `HolderRewardDistributor` (floored; rest stays in creator vault).
    pub nft_holder_share_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HolderRewardDistributor {
    pub launch: Pubkey,
    pub reward_mint: Pubkey,
    pub distribution_epoch: u64,
    pub total_funded: u128,
    pub cumulative_reward_per_share: u128,
    pub last_distribution_slot: u64,
    pub total_claimed: u128,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimPosition {
    pub launch: Pubkey,
    pub asset: Pubkey,
    pub reward_cursor: u128,
    pub total_claimed: u128,
    pub last_claim_slot: u64,
    pub last_reward_epoch: u64,
    pub claimed_this_epoch: u64,
    pub bump: u8,
}

/// Marks `MintReceipt.allocation` counted into `LaunchMonetization.total_share_units` once.
#[account]
#[derive(InitSpace)]
pub struct ShareRegistration {
    pub launch: Pubkey,
    pub asset: Pubkey,
    pub bump: u8,
}

/// Per-launch creator escrow for **20% of the 7% genesis mint tax** (SPL vault).
#[account]
#[derive(InitSpace)]
pub struct LaunchTreasury {
    pub launch: Pubkey,
    pub quote_mint: Pubkey,
    pub creator_vault: Pubkey,
    pub bump: u8,
}

/// Creator-only holder-claim pacing and optional incentive metadata. **Does not** change platform splits or reward index math.
#[account]
#[derive(InitSpace)]
pub struct CreatorRewardConfig {
    pub launch: Pubkey,
    pub creator: Pubkey,
    pub vesting_duration_slots: u64,
    pub claim_start_delay_slots: u64,
    pub transfer_cooldown_slots: u64,
    pub max_claim_per_epoch: u64,
    /// Bps (0–10_000) documenting optional share of creator-fee leg for NFT incentives; gates `fund_creator_nft_incentives`.
    pub creator_reward_share_bps: u16,
    pub immutable_after_launch: bool,
    pub config_initialized: bool,
    /// Slot captured at init (used with delays to derive claim/vesting windows).
    pub schedule_anchor_slot: u64,
    pub bump: u8,
}

// ── events ─────────────────────────────────────────────────────────────────

#[event]
pub struct NFTMintTaxCollected {
    pub launch: Pubkey,
    pub mint_price: u64,
    pub mint_tax: u64,
    pub quote_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct NFTMintPlatformShareTransferred {
    pub launch: Pubkey,
    pub amount: u64,
    pub platform_wallet: Pubkey,
    pub quote_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct NFTMintCreatorShareAllocated {
    pub launch: Pubkey,
    pub amount: u64,
    pub creator_vault: Pubkey,
    pub quote_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct NFTMintExecuted {
    pub launch: Pubkey,
    pub mint_price: u64,
    pub base_destination: Pubkey,
    pub asset_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct PlatformFeeCollected {
    pub launch: Pubkey,
    pub damm_pool: Pubkey,
    pub gross_amount: u64,
    pub platform_in: u64,
    pub creator_in: u64,
    pub holder_in: u64,
    pub burn_in: u64,
    pub fee_mint: Pubkey,
    pub slot: u64,
}

/// DAMM trading path: 3% tax on `trade_amount` settled from the launch fee buffer (indexing only).
#[event]
pub struct TradingTaxCollected {
    pub launch: Pubkey,
    pub damm_pool: Pubkey,
    pub trade_amount: u64,
    pub tax: u64,
    pub fee_mint: Pubkey,
    pub slot: u64,
}

/// Platform’s 20% leg of trading `tax` sent to `platform_wallet` (indexing only).
#[event]
pub struct PlatformRevenueCollected {
    pub launch: Pubkey,
    pub amount: u64,
    pub platform_wallet: Pubkey,
    pub fee_mint: Pubkey,
    pub slot: u64,
}

/// Creator’s 80% leg of trading `tax` split between vault and optional holder index (indexing only).
#[event]
pub struct CreatorRevenueAllocated {
    pub launch: Pubkey,
    pub creator_share_total: u64,
    pub to_creator_vault: u64,
    pub to_holder_rewards: u64,
    pub creator_vault: Pubkey,
    pub fee_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct CreatorFeeDistributed {
    pub launch: Pubkey,
    pub amount: u64,
    pub fee_mint: Pubkey,
    pub creator_treasury: Pubkey,
    pub slot: u64,
}

#[event]
pub struct HolderRewardsFunded {
    pub launch: Pubkey,
    pub amount: u64,
    pub reward_mint: Pubkey,
    pub cumulative_reward_per_share: u128,
    pub distribution_epoch: u64,
    pub slot: u64,
}

#[event]
pub struct HolderRewardsClaimed {
    pub launch: Pubkey,
    pub beneficiary: Pubkey,
    pub asset: Pubkey,
    pub amount: u64,
    pub new_claimer_total_claimed: u128,
    pub reward_cursor: u128,
    pub slot: u64,
}

#[event]
pub struct CreatorRewardConfigInitialized {
    pub launch: Pubkey,
    pub creator: Pubkey,
    pub vesting_duration_slots: u64,
    pub claim_start_delay_slots: u64,
    pub transfer_cooldown_slots: u64,
    pub max_claim_per_epoch: u64,
    pub creator_reward_share_bps: u16,
    pub immutable_after_launch: bool,
    pub schedule_anchor_slot: u64,
    pub slot: u64,
}

#[event]
pub struct CreatorRewardConfigUpdated {
    pub launch: Pubkey,
    pub vesting_duration_slots: u64,
    pub claim_start_delay_slots: u64,
    pub transfer_cooldown_slots: u64,
    pub max_claim_per_epoch: u64,
    pub creator_reward_share_bps: u16,
    pub immutable_after_launch: bool,
    pub schedule_anchor_slot: u64,
    pub slot: u64,
}

#[event]
pub struct CreatorIncentiveFunded {
    pub launch: Pubkey,
    pub amount: u64,
    pub reward_mint: Pubkey,
    pub cumulative_reward_per_share: u128,
    pub distribution_epoch: u64,
    pub slot: u64,
}

#[event]
pub struct NFTClaimParametersApplied {
    pub launch: Pubkey,
    pub beneficiary: Pubkey,
    pub asset: Pubkey,
    pub raw_claimable: u64,
    pub paced_claimable: u64,
    pub distribution_epoch: u64,
    pub slot: u64,
}

#[event]
pub struct TaxCollected {
    pub launch: Pubkey,
    pub leg: u8,
    pub amount: u64,
    pub mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct TreasuryWithdrawal {
    pub vault_owner: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct RewardEpochAdvanced {
    pub launch: Pubkey,
    pub old_epoch: u64,
    pub new_epoch: u64,
    pub slot: u64,
}

// ── pure math ─────────────────────────────────────────────────────────────

/// `mint_tax = mint_price * 700 / 10_000`; platform gets remainder after **floored** creator 20%.
pub fn split_genesis_mint_tax(mint_price: u64) -> Result<(u64, u64, u64)> {
    let mp = mint_price as u128;
    let mint_tax = mp
        .checked_mul(GENESIS_MINT_TAX_BPS as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let creator_floor = mint_tax
        .checked_mul(CREATOR_SHARE_OF_MINT_TAX_BPS as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(MINT_TAX_SPLIT_DENOM_BPS as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let platform_part = mint_tax
        .checked_sub(creator_floor)
        .ok_or(LaunchError::MathOverflow)?;
    Ok((
        u64::try_from(mint_tax).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(platform_part).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(creator_floor).map_err(|_| LaunchError::MathOverflow)?,
    ))
}

/// `tax = trade_amount * TRADING_TAX_BPS / 10_000`; platform = `tax * 2000 / 10_000` (floor); creator_leg = tax − platform;
/// holder = creator_leg * nft_holder_share_bps / 10_000 (floor); creator_vault = creator_leg − holder.
pub fn split_trading_tax_settlement(
    trade_amount: u64,
    nft_holder_share_bps: u16,
) -> Result<(u64, u64, u64, u64)> {
    require!(
        (nft_holder_share_bps as u32) <= 10_000,
        LaunchError::BpsInvariant
    );
    let ta = trade_amount as u128;
    let tax = ta
        .checked_mul(TRADING_TAX_BPS as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let platform = tax
        .checked_mul(TRADING_TAX_PLATFORM_LEG_BPS as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let creator_leg = tax
        .checked_sub(platform)
        .ok_or(LaunchError::MathOverflow)?;
    let holder = if nft_holder_share_bps == 0 {
        0u128
    } else {
        creator_leg
            .checked_mul(nft_holder_share_bps as u128)
            .ok_or(LaunchError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(LaunchError::MathOverflow)?
    };
    let creator_vault = creator_leg
        .checked_sub(holder)
        .ok_or(LaunchError::MathOverflow)?;
    Ok((
        u64::try_from(tax).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(platform).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(creator_vault).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(holder).map_err(|_| LaunchError::MathOverflow)?,
    ))
}

pub fn enforce_fee_bps_sum(
    platform_fee_bps: u16,
    creator_fee_bps: u16,
    nft_holder_fee_bps: u16,
    burn_fee_bps: u16,
) -> Result<()> {
    let sum = (platform_fee_bps as u32)
        .checked_add(creator_fee_bps as u32)
        .and_then(|s| s.checked_add(nft_holder_fee_bps as u32))
        .and_then(|s| s.checked_add(burn_fee_bps as u32))
        .ok_or(LaunchError::MathOverflow)?;
    require!(sum <= 10_000, LaunchError::BpsInvariant);
    Ok(())
}

pub fn split_by_bps(
    total: u64,
    platform_fee_bps: u16,
    creator_fee_bps: u16,
    nft_holder_fee_bps: u16,
    burn_fee_bps: u16,
) -> Result<(u64, u64, u64, u64)> {
    let t = total as u128;
    let mut p = t
        .checked_mul(platform_fee_bps as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let c = t
        .checked_mul(creator_fee_bps as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let h = t
        .checked_mul(nft_holder_fee_bps as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let b = t
        .checked_mul(burn_fee_bps as u128)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(LaunchError::MathOverflow)?;
    let sum = p
        .checked_add(c)
        .and_then(|s| s.checked_add(h))
        .and_then(|s| s.checked_add(b))
        .ok_or(LaunchError::MathOverflow)?;
    let remainder = t.checked_sub(sum).ok_or(LaunchError::MathOverflow)?;
    // remainder stays in first bucket (platform) — deterministic, favors vault solvency
    p = p.checked_add(remainder).ok_or(LaunchError::MathOverflow)?;
    Ok((
        u64::try_from(p).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(c).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(h).map_err(|_| LaunchError::MathOverflow)?,
        u64::try_from(b).map_err(|_| LaunchError::MathOverflow)?,
    ))
}

pub fn claimable_rewards_floor(
    shares: u128,
    cumulative_reward_per_share: u128,
    reward_cursor: u128,
) -> Result<u64> {
    let delta = cumulative_reward_per_share
        .checked_sub(reward_cursor)
        .ok_or(LaunchError::MathOverflow)?;
    let owed = shares
        .checked_mul(delta)
        .ok_or(LaunchError::MathOverflow)?
        .checked_div(REWARD_INDEX_PRECISION)
        .ok_or(LaunchError::MathOverflow)?;
    u64::try_from(owed).map_err(|_| LaunchError::MathOverflow.into())
}

/// Creator-side pacing on index-derived `raw_claimable` (does not mutate `HolderRewardDistributor` math).
pub fn apply_holder_claim_pacing(
    raw_claimable: u64,
    current_slot: u64,
    distribution_epoch: u64,
    schedule_anchor_slot: u64,
    claim_start_delay_slots: u64,
    vesting_duration_slots: u64,
    transfer_cooldown_slots: u64,
    max_claim_per_epoch: u64,
    last_claim_slot: u64,
    cp_last_reward_epoch: u64,
    cp_claimed_this_epoch: u64,
) -> Result<(u64, u64, u64)> {
    let claim_gate = schedule_anchor_slot
        .checked_add(claim_start_delay_slots)
        .ok_or(LaunchError::MathOverflow)?;
    let vesting_end = claim_gate
        .checked_add(vesting_duration_slots)
        .ok_or(LaunchError::MathOverflow)?;
    if transfer_cooldown_slots > 0 && last_claim_slot > 0 {
        let next = last_claim_slot
            .checked_add(transfer_cooldown_slots)
            .ok_or(LaunchError::MathOverflow)?;
        require!(
            current_slot >= next,
            LaunchError::HolderClaimCooldown
        );
    }
    if current_slot < claim_gate {
        return Ok((0, cp_last_reward_epoch, cp_claimed_this_epoch));
    }
    let vested_cap = if current_slot >= vesting_end {
        raw_claimable
    } else {
        let slots_in = current_slot - claim_gate;
        let n = (slots_in as u128)
            .checked_mul(raw_claimable as u128)
            .ok_or(LaunchError::MathOverflow)?;
        let d = vesting_duration_slots as u128;
        u64::try_from(n.checked_div(d).ok_or(LaunchError::MathOverflow)?)
            .map_err(|_| LaunchError::MathOverflow)?
    };
    let mut claimed_epoch = if distribution_epoch != cp_last_reward_epoch {
        0u64
    } else {
        cp_claimed_this_epoch
    };
    let room = max_claim_per_epoch.saturating_sub(claimed_epoch);
    let pay = vested_cap.min(room);
    claimed_epoch = claimed_epoch.saturating_add(pay);
    Ok((pay, distribution_epoch, claimed_epoch))
}

#[cfg(test)]
mod reward_math_tests {
    use super::*;

    #[test]
    fn trading_tax_three_percent_and_split() {
        // trade 1_000_000 → tax 30_000; platform 20% of tax = 6_000; creator leg 24_000
        let (tax, plat, vault, hold) = split_trading_tax_settlement(1_000_000, 0).unwrap();
        assert_eq!(tax, 30_000);
        assert_eq!(plat, 6_000);
        assert_eq!(vault, 24_000);
        assert_eq!(hold, 0);
        assert_eq!(plat + vault + hold, tax);
    }

    #[test]
    fn trading_tax_holder_skim_floors() {
        // creator leg 24_000; 3333 bps → 7999.592 → floor 7999 to holders; vault 16001
        let (tax, plat, vault, hold) = split_trading_tax_settlement(1_000_000, 3333).unwrap();
        assert_eq!(tax, 30_000);
        assert_eq!(plat, 6_000);
        assert_eq!(hold, 7_999);
        assert_eq!(vault, 24_000 - 7_999);
        assert_eq!(plat + vault + hold, tax);
    }

    #[test]
    fn holder_claim_pacing_epoch_cap() {
        let (pay, epoch, claimed) =
            apply_holder_claim_pacing(1000, 10, 1, 0, 0, 20, 0, 300, 0, 0, 0).unwrap();
        assert_eq!(pay, 300);
        assert_eq!(epoch, 1);
        assert_eq!(claimed, 300);
    }

    #[test]
    fn holder_claim_pacing_before_gate() {
        let (pay, _, _) = apply_holder_claim_pacing(1000, 4, 1, 0, 10, 20, 0, u64::MAX, 0, 0, 0).unwrap();
        assert_eq!(pay, 0);
    }

    #[test]
    fn fee_bps_sum_accepts_boundary() {
        enforce_fee_bps_sum(2500, 2500, 2500, 2500).unwrap();
        enforce_fee_bps_sum(10_000, 0, 0, 0).unwrap();
    }

    #[test]
    fn fee_bps_sum_rejects_over() {
        assert!(enforce_fee_bps_sum(5000, 5000, 1, 0).is_err());
    }

    #[test]
    fn split_partitions_exact_bps() {
        // 2500 bps = 25% each of 10_000 lamports
        let (p, c, h, b) = split_by_bps(10_000, 2500, 2500, 2500, 2500).unwrap();
        assert_eq!(p + c + h + b, 10_000);
        assert_eq!(p, 2500);
        assert_eq!(c, 2500);
        assert_eq!(h, 2500);
        assert_eq!(b, 2500);
    }

    #[test]
    fn split_remainder_goes_to_platform() {
        // 3000 bps = 30%; 900 bps = 9% → leaves 1% remainder to platform bucket
        let (p, c, h, b) = split_by_bps(10_000, 3000, 3000, 3000, 900).unwrap();
        assert_eq!(p + c + h + b, 10_000);
        assert_eq!(c, 3000);
        assert_eq!(h, 3000);
        assert_eq!(b, 900);
        assert_eq!(p, 3100);
    }

    #[test]
    fn genesis_mint_tax_split_floors_creator_favors_platform() {
        let (tax, plat, cr) = split_genesis_mint_tax(10_000).unwrap();
        assert_eq!(tax, 700);
        assert_eq!(cr, 140);
        assert_eq!(plat, 560);
        assert_eq!(plat + cr, tax);
    }

    #[test]
    fn claimable_rounds_down() {
        let shares = 100u128;
        let rps = REWARD_INDEX_PRECISION * 3 / 2;
        let owed = claimable_rewards_floor(shares, rps, 0).unwrap();
        assert_eq!(owed, 150);
    }

    #[test]
    fn claimable_zero_when_caught_up() {
        let rps = REWARD_INDEX_PRECISION * 2;
        assert_eq!(claimable_rewards_floor(50, rps, rps).unwrap(), 0);
    }

    #[test]
    fn claimable_errors_when_cursor_ahead_of_index() {
        assert!(claimable_rewards_floor(10, 100, 200).is_err());
    }
}
