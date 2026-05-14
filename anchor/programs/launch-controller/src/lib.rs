//! **Single financial truth** for this launchpad: deposits, mint binding, allocation,
//! vesting, and claims are enforced here. Meteora Alpha Vault / DAMM remain execution
//! venues; this program stores **DepositReceipt** (Option A) and **MintReceipt** and
//! never trusts off-chain allocation math.
//!
//! **Lifecycle** (only `advance_lifecycle` mutates):  
//! `DRAFT → VAULT_OPEN → MINT_ACTIVE → TRADING_ACTIVE → CLAIM_ACTIVE → FINALIZED`
//!
//! **Option A**: `record_genesis_participation` requires `deposit_lamports ==
//! launch.expected_quote_per_mint` and writes a `DepositReceipt` + `MintReceipt` whose
//! `allocation` is derived only from on-chain fields (`tokens_per_quote_*`).

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

mod monetization;
pub use monetization::*;

declare_id!("EfjEi5nQVmupvYHLLhexmcrM39WhdFq8Y7r4waSbyxEf");

// ── lifecycle (single source of truth) ─────────────────────────────────────

pub const LC_DRAFT: u8 = 0;
pub const LC_VAULT_OPEN: u8 = 1;
pub const LC_MINT_ACTIVE: u8 = 2;
pub const LC_TRADING_ACTIVE: u8 = 3;
pub const LC_CLAIM_ACTIVE: u8 = 4;
pub const LC_FINALIZED: u8 = 5;

/// Max Slice B reserve as basis points of the 1B supply (30% = 3000 bps). Keep in sync with `MAX_SLICE_B_RESERVE_BPS` in `src/lib/launch/slice-b-reserve.ts`.
pub const MAX_SLICE_B_RESERVE_BPS: u16 = 3000;

fn valid_advance(cur: u8, next: u8) -> bool {
    matches!(
        (cur, next),
        (LC_DRAFT, LC_VAULT_OPEN)
            | (LC_VAULT_OPEN, LC_MINT_ACTIVE)
            | (LC_MINT_ACTIVE, LC_TRADING_ACTIVE)
            | (LC_TRADING_ACTIVE, LC_CLAIM_ACTIVE)
            | (LC_CLAIM_ACTIVE, LC_FINALIZED)
    )
}

#[program]
pub mod launch_controller {
    use super::*;

    pub fn initialize_launch(
        ctx: Context<InitializeLaunch>,
        cliff_seconds: u64,
        vesting_seconds: u64,
        expected_quote_per_mint: u64,
        tokens_per_quote_num: u64,
        tokens_per_quote_den: u64,
        genesis_supply: u64,
        slice_b_reserve_bps: u16,
        slice_b_creator_of_reserve_bps: u16,
    ) -> Result<()> {
        require!(vesting_seconds > 0, LaunchError::ZeroVesting);
        require!(tokens_per_quote_den > 0, LaunchError::ZeroDenominator);
        require!(expected_quote_per_mint > 0, LaunchError::BadDepositAmount);
        require!(slice_b_reserve_bps <= MAX_SLICE_B_RESERVE_BPS, LaunchError::BadSliceBps);
        require!(slice_b_creator_of_reserve_bps <= 10_000, LaunchError::BadSliceBps);
        let st = &mut ctx.accounts.launch_state;
        st.authority = ctx.accounts.authority.key();
        st.collection_mint = ctx.accounts.collection_mint.key();
        st.project_mint = ctx.accounts.project_mint.key();
        st.alpha_vault = Pubkey::default();
        st.vesting_start_ts = 0;
        st.cliff_seconds = cliff_seconds;
        st.vesting_seconds = vesting_seconds;
        st.lifecycle = LC_DRAFT;
        st.expected_quote_per_mint = expected_quote_per_mint;
        st.tokens_per_quote_num = tokens_per_quote_num;
        st.tokens_per_quote_den = tokens_per_quote_den;
        st.deposit_seq = 0;
        st.genesis_supply = genesis_supply;
        st.trading_live_at = 0;
        st.slice_b_reserve_bps = slice_b_reserve_bps;
        st.slice_b_creator_of_reserve_bps = slice_b_creator_of_reserve_bps;
        st.bump = ctx.bumps.launch_state;
        emit!(LaunchInitialized {
            launch: st.key(),
            collection_mint: st.collection_mint,
            project_mint: st.project_mint,
            lifecycle: st.lifecycle,
            expected_quote_per_mint,
        });
        Ok(())
    }

    pub fn set_alpha_vault(ctx: Context<SetAlphaVault>, vault: Pubkey) -> Result<()> {
        require!(vault != Pubkey::default(), LaunchError::BadVault);
        let st = &mut ctx.accounts.launch_state;
        require!(st.lifecycle == LC_DRAFT, LaunchError::BadLifecycle);
        st.alpha_vault = vault;
        st.lifecycle = LC_VAULT_OPEN;
        emit!(AlphaVaultLinked {
            launch: st.key(),
            alpha_vault: vault,
            lifecycle: st.lifecycle,
        });
        Ok(())
    }

    pub fn advance_lifecycle(ctx: Context<AdvanceLifecycle>, next: u8) -> Result<()> {
        let st = &mut ctx.accounts.launch_state;
        require!(
            valid_advance(st.lifecycle, next),
            LaunchError::BadTransition
        );
        if next == LC_CLAIM_ACTIVE {
            st.vesting_start_ts = if st.trading_live_at > 0 {
                st.trading_live_at
            } else {
                Clock::get()?.unix_timestamp
            };
        }
        st.lifecycle = next;
        emit!(LifecycleAdvanced {
            launch: st.key(),
            lifecycle: st.lifecycle,
        });
        Ok(())
    }

    /// User + fixed quote: writes DepositReceipt + MintReceipt; allocation is purely on-chain.
    pub fn record_genesis_participation(
        ctx: Context<RecordGenesisParticipation>,
        deposit_lamports: u64,
        asset_mint: Pubkey,
        vault_tier: u8,
        deposit_seq: u64,
    ) -> Result<()> {
        let st = &mut ctx.accounts.launch_state;
        require!(st.lifecycle == LC_MINT_ACTIVE, LaunchError::BadLifecycle);
        require!(
            deposit_lamports == st.expected_quote_per_mint,
            LaunchError::BadDepositAmount
        );
        require!(deposit_seq == st.deposit_seq, LaunchError::BadDepositSeq);

        let allocation = (deposit_lamports as u128)
            .checked_mul(st.tokens_per_quote_num as u128)
            .ok_or(LaunchError::MathOverflow)?
            .checked_div(st.tokens_per_quote_den as u128)
            .ok_or(LaunchError::MathOverflow)?;
        let allocation = u64::try_from(allocation).map_err(|_| LaunchError::MathOverflow)?;

        let dr = &mut ctx.accounts.deposit_receipt;
        dr.launch = st.key();
        dr.depositor = ctx.accounts.user.key();
        dr.seq = deposit_seq;
        dr.lamports = deposit_lamports;
        dr.slot = Clock::get()?.slot;
        dr.bump = ctx.bumps.deposit_receipt;

        let mr = &mut ctx.accounts.mint_receipt;
        mr.launch = st.key();
        mr.asset = asset_mint;
        mr.owner = ctx.accounts.user.key();
        mr.allocation = allocation;
        mr.claimed = 0;
        mr.vault_tier = vault_tier;
        mr.entry_ts = Clock::get()?.unix_timestamp;
        mr.bump = ctx.bumps.mint_receipt;

        st.deposit_seq = st
            .deposit_seq
            .checked_add(1)
            .ok_or(LaunchError::MathOverflow)?;

        if st.genesis_supply > 0 && st.deposit_seq == st.genesis_supply {
            st.trading_live_at = Clock::get()?.unix_timestamp;
            st.lifecycle = LC_TRADING_ACTIVE;
            emit!(GenesisSellout {
                launch: st.key(),
                trading_live_at: st.trading_live_at,
                deposit_seq: st.deposit_seq,
            });
        }

        emit!(GenesisParticipationRecorded {
            launch: st.key(),
            depositor: dr.depositor,
            seq: dr.seq,
            lamports: dr.lamports,
            asset: mr.asset,
            allocation: mr.allocation,
            vault_tier,
        });
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let launch = &ctx.accounts.launch_state;
        require!(launch.lifecycle == LC_CLAIM_ACTIVE, LaunchError::BadLifecycle);
        let mr = &mut ctx.accounts.mint_receipt;
        require_keys_eq!(mr.launch, launch.key());

        let unlocked = vested_amount(
            mr.allocation,
            launch.vesting_start_ts,
            launch.cliff_seconds,
            launch.vesting_seconds,
        )?;
        let claimable = unlocked.saturating_sub(mr.claimed);
        require!(claimable > 0, LaunchError::NothingToClaim);

        let vault_bal = ctx.accounts.vault_token.amount;
        let pay = claimable.min(vault_bal);
        require!(pay > 0, LaunchError::VaultEmpty);

        let collection_mint = launch.collection_mint;
        let bump = [launch.bump];
        let seeds: [&[u8]; 3] = [b"launch", collection_mint.as_ref(), bump.as_ref()];
        let signer = &[&seeds[..]];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.beneficiary_token.to_account_info(),
                authority: launch.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, pay)?;

        mr.claimed = mr.claimed.checked_add(pay).ok_or(LaunchError::MathOverflow)?;

        emit!(TrancheClaimed {
            launch: launch.key(),
            asset: mr.asset,
            beneficiary: ctx.accounts.beneficiary.key(),
            amount: pay,
            new_claimed_total: mr.claimed,
        });
        Ok(())
    }

    // ── monetization (L1 authority) ─────────────────────────────────────

    pub fn initialize_platform_fee_config(
        ctx: Context<InitializePlatformFeeConfig>,
        platform_fee_bps: u16,
        creator_fee_bps: u16,
        nft_holder_fee_bps: u16,
        burn_fee_bps: u16,
        burn_treasury: Pubkey,
        fee_token_mint: Pubkey,
    ) -> Result<()> {
        enforce_fee_bps_sum(
            platform_fee_bps,
            creator_fee_bps,
            nft_holder_fee_bps,
            burn_fee_bps,
        )?;
        let cfg = &mut ctx.accounts.platform_fee_config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.platform_fee_bps = platform_fee_bps;
        cfg.creator_fee_bps = creator_fee_bps;
        cfg.nft_holder_fee_bps = nft_holder_fee_bps;
        cfg.burn_fee_bps = burn_fee_bps;
        cfg.platform_wallet = CANONICAL_PLATFORM_WALLET;
        cfg.burn_treasury = burn_treasury;
        cfg.fee_token_mint = fee_token_mint;
        cfg.paused = 0;
        cfg.version = 1;
        cfg.bump = ctx.bumps.platform_fee_config;
        Ok(())
    }

    pub fn update_platform_fee_config(
        ctx: Context<UpdatePlatformFeeConfig>,
        platform_fee_bps: u16,
        creator_fee_bps: u16,
        nft_holder_fee_bps: u16,
        burn_fee_bps: u16,
        burn_treasury: Pubkey,
        fee_token_mint: Pubkey,
    ) -> Result<()> {
        enforce_fee_bps_sum(
            platform_fee_bps,
            creator_fee_bps,
            nft_holder_fee_bps,
            burn_fee_bps,
        )?;
        let cfg = &mut ctx.accounts.platform_fee_config;
        cfg.platform_fee_bps = platform_fee_bps;
        cfg.creator_fee_bps = creator_fee_bps;
        cfg.nft_holder_fee_bps = nft_holder_fee_bps;
        cfg.burn_fee_bps = burn_fee_bps;
        cfg.burn_treasury = burn_treasury;
        cfg.fee_token_mint = fee_token_mint;
        Ok(())
    }

    pub fn set_platform_paused(ctx: Context<SetPlatformPaused>, paused: u8) -> Result<()> {
        ctx.accounts.platform_fee_config.paused = paused;
        Ok(())
    }

    pub fn init_launch_monetization(
        ctx: Context<InitLaunchMonetization>,
        damm_pool: Pubkey,
        reward_mint: Pubkey,
        creator_treasury_override: Pubkey,
        nft_holder_share_bps: u16,
    ) -> Result<()> {
        require!(
            (nft_holder_share_bps as u32) <= 10_000,
            LaunchError::BpsInvariant
        );
        let st = &ctx.accounts.launch_state;
        let lm = &mut ctx.accounts.launch_monetization;
        lm.launch = st.key();
        lm.buy_tax_bps = 0;
        lm.sell_tax_bps = 0;
        lm.transfer_tax_bps = 0;
        lm.tax_enabled = 0;
        lm.damm_pool = damm_pool;
        lm.reward_mint = reward_mint;
        lm.total_share_units = 0;
        lm.creator_treasury_override = creator_treasury_override;
        lm.nft_holder_share_bps = nft_holder_share_bps;
        lm.bump = ctx.bumps.launch_monetization;
        Ok(())
    }

    /// Creator (launch authority): share of **trading-tax creator leg** sent to holder reward index (0–10_000 bps).
    pub fn set_nft_holder_share_bps(ctx: Context<ToggleTax>, nft_holder_share_bps: u16) -> Result<()> {
        require!(
            (nft_holder_share_bps as u32) <= 10_000,
            LaunchError::BpsInvariant
        );
        ctx.accounts.launch_monetization.nft_holder_share_bps = nft_holder_share_bps;
        Ok(())
    }

    pub fn init_holder_reward_distributor(ctx: Context<InitHolderRewardDistributor>) -> Result<()> {
        let st = &ctx.accounts.launch_state;
        let mon = &ctx.accounts.launch_monetization;
        let d = &mut ctx.accounts.holder_reward_distributor;
        d.launch = st.key();
        d.reward_mint = mon.reward_mint;
        d.distribution_epoch = 0;
        d.total_funded = 0;
        d.cumulative_reward_per_share = 0;
        d.last_distribution_slot = Clock::get()?.slot;
        d.total_claimed = 0;
        d.bump = ctx.bumps.holder_reward_distributor;
        Ok(())
    }

    pub fn register_monetization_share(ctx: Context<RegisterMonetizationShare>) -> Result<()> {
        let mr = &ctx.accounts.mint_receipt;
        require_keys_eq!(mr.launch, ctx.accounts.launch_state.key());
        let add = mr.allocation as u128;
        let lm = &mut ctx.accounts.launch_monetization;
        lm.total_share_units = lm
            .total_share_units
            .checked_add(add)
            .ok_or(LaunchError::MathOverflow)?;
        let sr = &mut ctx.accounts.share_registration;
        sr.launch = ctx.accounts.launch_state.key();
        sr.asset = mr.asset;
        sr.bump = ctx.bumps.share_registration;
        Ok(())
    }

    pub fn toggle_tax(ctx: Context<ToggleTax>, enabled: u8) -> Result<()> {
        ctx.accounts.launch_monetization.tax_enabled = enabled;
        Ok(())
    }

    pub fn update_tax(
        ctx: Context<ToggleTax>,
        buy_tax_bps: u16,
        sell_tax_bps: u16,
        transfer_tax_bps: u16,
    ) -> Result<()> {
        require!(buy_tax_bps <= MAX_TAX_BPS, LaunchError::TaxTooHigh);
        require!(sell_tax_bps <= MAX_TAX_BPS, LaunchError::TaxTooHigh);
        require!(transfer_tax_bps <= MAX_TAX_BPS, LaunchError::TaxTooHigh);
        let lm = &mut ctx.accounts.launch_monetization;
        lm.buy_tax_bps = buy_tax_bps;
        lm.sell_tax_bps = sell_tax_bps;
        lm.transfer_tax_bps = transfer_tax_bps;
        let slot = Clock::get()?.slot;
        emit!(TaxCollected {
            launch: lm.launch,
            leg: 255,
            amount: 0,
            mint: lm.reward_mint,
            slot,
        });
        Ok(())
    }

    /// One-time per launch: creator-only holder claim pacing + optional incentive metadata (does not touch platform math).
    pub fn initialize_creator_reward_config(
        ctx: Context<InitializeCreatorRewardConfig>,
        vesting_duration_slots: u64,
        claim_start_delay_slots: u64,
        transfer_cooldown_slots: u64,
        max_claim_per_epoch: u64,
        creator_reward_share_bps: u16,
        immutable_after_launch: bool,
    ) -> Result<()> {
        require!(vesting_duration_slots > 0, LaunchError::ZeroSplitAmount);
        require!(max_claim_per_epoch > 0, LaunchError::ZeroSplitAmount);
        require!(
            (creator_reward_share_bps as u32) <= 10_000,
            LaunchError::BpsInvariant
        );
        let st = &ctx.accounts.launch_state;
        require_keys_eq!(ctx.accounts.creator.key(), st.authority, LaunchError::Unauthorized);
        require!(
            !(immutable_after_launch && st.lifecycle >= LC_TRADING_ACTIVE),
            LaunchError::CreatorRewardConfigBadImmutable
        );
        let slot_now = Clock::get()?.slot;
        let cfg = &mut ctx.accounts.creator_reward_config;
        cfg.launch = st.key();
        cfg.creator = st.authority;
        cfg.vesting_duration_slots = vesting_duration_slots;
        cfg.claim_start_delay_slots = claim_start_delay_slots;
        cfg.transfer_cooldown_slots = transfer_cooldown_slots;
        cfg.max_claim_per_epoch = max_claim_per_epoch;
        cfg.creator_reward_share_bps = creator_reward_share_bps;
        cfg.immutable_after_launch = immutable_after_launch;
        cfg.config_initialized = true;
        cfg.schedule_anchor_slot = slot_now;
        cfg.bump = ctx.bumps.creator_reward_config;
        emit!(CreatorRewardConfigInitialized {
            launch: st.key(),
            creator: cfg.creator,
            vesting_duration_slots,
            claim_start_delay_slots,
            transfer_cooldown_slots,
            max_claim_per_epoch,
            creator_reward_share_bps,
            immutable_after_launch,
            schedule_anchor_slot: cfg.schedule_anchor_slot,
            slot: slot_now,
        });
        Ok(())
    }

    /// Update creator pacing fields (blocked when `immutable_after_launch` and lifecycle >= trading).
    pub fn update_creator_reward_config(
        ctx: Context<UpdateCreatorRewardConfig>,
        vesting_duration_slots: u64,
        claim_start_delay_slots: u64,
        transfer_cooldown_slots: u64,
        max_claim_per_epoch: u64,
        creator_reward_share_bps: u16,
        immutable_after_launch: bool,
    ) -> Result<()> {
        require!(vesting_duration_slots > 0, LaunchError::ZeroSplitAmount);
        require!(max_claim_per_epoch > 0, LaunchError::ZeroSplitAmount);
        require!(
            (creator_reward_share_bps as u32) <= 10_000,
            LaunchError::BpsInvariant
        );
        let st = &ctx.accounts.launch_state;
        require_keys_eq!(ctx.accounts.creator.key(), st.authority, LaunchError::Unauthorized);
        let cfg = &mut ctx.accounts.creator_reward_config;
        require!(cfg.config_initialized, LaunchError::CreatorRewardConfigUninitialized);
        require!(
            !(cfg.immutable_after_launch && st.lifecycle >= LC_TRADING_ACTIVE),
            LaunchError::CreatorRewardConfigLocked
        );
        let slot_now = Clock::get()?.slot;
        cfg.vesting_duration_slots = vesting_duration_slots;
        cfg.claim_start_delay_slots = claim_start_delay_slots;
        cfg.transfer_cooldown_slots = transfer_cooldown_slots;
        cfg.max_claim_per_epoch = max_claim_per_epoch;
        cfg.creator_reward_share_bps = creator_reward_share_bps;
        cfg.immutable_after_launch = immutable_after_launch;
        cfg.schedule_anchor_slot = slot_now;
        emit!(CreatorRewardConfigUpdated {
            launch: st.key(),
            vesting_duration_slots,
            claim_start_delay_slots,
            transfer_cooldown_slots,
            max_claim_per_epoch,
            creator_reward_share_bps,
            immutable_after_launch,
            schedule_anchor_slot: cfg.schedule_anchor_slot,
            slot: slot_now,
        });
        Ok(())
    }

    /// Creator funds holder reward vault from creator treasury SPL (same index bump as `fund_holder_rewards_from_vault`).
    pub fn fund_creator_nft_incentives(ctx: Context<FundCreatorNftIncentives>, amount: u64) -> Result<()> {
        require!(amount > 0, LaunchError::ZeroSplitAmount);
        let cfg = &ctx.accounts.creator_reward_config;
        require!(cfg.config_initialized, LaunchError::CreatorRewardConfigUninitialized);
        require!(
            cfg.creator_reward_share_bps > 0,
            LaunchError::CreatorIncentiveDisabled
        );
        require_keys_eq!(cfg.launch, ctx.accounts.launch_state.key());
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.launch_state.authority,
            LaunchError::Unauthorized
        );
        let mon = &ctx.accounts.launch_monetization;
        require_keys_eq!(mon.reward_mint, ctx.accounts.reward_mint.key());
        require!(mon.total_share_units > 0, LaunchError::ZeroShareUnits);

        let col = ctx.accounts.launch_state.collection_mint;
        let bump = [ctx.bumps.creator_treasury];
        let ct_seeds: [&[u8]; 3] = [b"creator_treasury", col.as_ref(), bump.as_ref()];
        let ct_signer = &[&ct_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_treasury_token.to_account_info(),
                    to: ctx.accounts.holder_vault_token.to_account_info(),
                    authority: ctx.accounts.creator_treasury.to_account_info(),
                },
                ct_signer,
            ),
            amount,
        )?;

        let dist = &mut ctx.accounts.holder_reward_distributor;
        let inc = (amount as u128)
            .checked_mul(REWARD_INDEX_PRECISION)
            .ok_or(LaunchError::MathOverflow)?
            .checked_div(mon.total_share_units)
            .ok_or(LaunchError::MathOverflow)?;
        dist.cumulative_reward_per_share = dist
            .cumulative_reward_per_share
            .checked_add(inc)
            .ok_or(LaunchError::MathOverflow)?;
        dist.total_funded = dist
            .total_funded
            .checked_add(amount as u128)
            .ok_or(LaunchError::MathOverflow)?;
        dist.last_distribution_slot = Clock::get()?.slot;

        let slot = Clock::get()?.slot;
        emit!(CreatorIncentiveFunded {
            launch: dist.launch,
            amount,
            reward_mint: dist.reward_mint,
            cumulative_reward_per_share: dist.cumulative_reward_per_share,
            distribution_epoch: dist.distribution_epoch,
            slot,
        });
        Ok(())
    }

    /// Settles **3% trading tax** from the launch fee buffer: 20% of `tax` → platform wallet, 80% → creator leg;
    /// optional `nft_holder_share_bps` of the creator leg → holder reward index; remainder → `LaunchTreasury.creator_vault`.
    /// Caller passes `trade_amount` so `tax` is derived on-chain; buffer must hold at least `tax`.
    pub fn collect_platform_fee(ctx: Context<CollectPlatformFee>, trade_amount: u64) -> Result<()> {
        require!(trade_amount > 0, LaunchError::ZeroSplitAmount);
        require!(ctx.accounts.platform_fee_config.paused == 0, LaunchError::Paused);
        let st = &ctx.accounts.launch_state;
        require!(
            st.lifecycle >= LC_TRADING_ACTIVE && st.lifecycle <= LC_FINALIZED,
            LaunchError::BadLifecycle
        );
        require!(
            ctx.accounts.launch_monetization.tax_enabled != 0,
            LaunchError::TradingTaxDisabled
        );
        require_keys_eq!(
            ctx.accounts.meteora_program.key(),
            METEORA_CP_AMM_PROGRAM_ID,
            LaunchError::BadMeteoraProgram
        );
        require_keys_eq!(
            ctx.accounts.damm_pool.key(),
            ctx.accounts.launch_monetization.damm_pool,
            LaunchError::BadDammPool
        );
        require_keys_eq!(
            ctx.accounts.fee_mint.key(),
            ctx.accounts.platform_fee_config.fee_token_mint,
            LaunchError::BadFeeMint
        );
        require_keys_eq!(
            ctx.accounts.launch_monetization.reward_mint,
            ctx.accounts.fee_mint.key(),
            LaunchError::BadFeeMint
        );
        require_keys_eq!(
            ctx.accounts.launch_treasury.quote_mint,
            ctx.accounts.fee_mint.key(),
            LaunchError::BadFeeMint
        );

        let nft_bps = ctx.accounts.launch_monetization.nft_holder_share_bps;
        let (tax, platform_amt, creator_vault_amt, holder_amt) =
            split_trading_tax_settlement(trade_amount, nft_bps)?;

        let fee_buf = &ctx.accounts.fee_buffer;
        require!(fee_buf.amount >= tax, LaunchError::InsufficientFeeBuffer);

        if holder_amt > 0 {
            require!(
                ctx.accounts.launch_monetization.total_share_units > 0,
                LaunchError::HolderFundingRequiresShares
            );
        }

        let collection_mint = ctx.accounts.launch_state.collection_mint;
        let bump = [ctx.accounts.launch_state.bump];
        let seeds: [&[u8]; 3] = [b"launch", collection_mint.as_ref(), bump.as_ref()];
        let signer = &[&seeds[..]];

        let auth_ai = ctx.accounts.launch_state.to_account_info();
        let tok = ctx.accounts.token_program.to_account_info();

        for (amt, to) in [
            (platform_amt, ctx.accounts.platform_dest.to_account_info()),
            (holder_amt, ctx.accounts.holder_dest.to_account_info()),
            (creator_vault_amt, ctx.accounts.creator_vault.to_account_info()),
        ] {
            if amt == 0 {
                continue;
            }
            token::transfer(
                CpiContext::new_with_signer(
                    tok.clone(),
                    Transfer {
                        from: fee_buf.to_account_info(),
                        to,
                        authority: auth_ai.clone(),
                    },
                    signer,
                ),
                amt,
            )?;
        }

        let creator_share_total = tax
            .checked_sub(platform_amt)
            .ok_or(LaunchError::MathOverflow)?;
        let slot = Clock::get()?.slot;
        let qm = ctx.accounts.fee_mint.key();
        let launch_k = st.key();
        let pool_k = ctx.accounts.damm_pool.key();

        emit!(TradingTaxCollected {
            launch: launch_k,
            damm_pool: pool_k,
            trade_amount,
            tax,
            fee_mint: qm,
            slot,
        });
        emit!(CreatorRevenueAllocated {
            launch: launch_k,
            creator_share_total,
            to_creator_vault: creator_vault_amt,
            to_holder_rewards: holder_amt,
            creator_vault: ctx.accounts.creator_vault.key(),
            fee_mint: qm,
            slot,
        });

        if holder_amt > 0 {
            let mon = &ctx.accounts.launch_monetization;
            let dist = &mut ctx.accounts.holder_reward_distributor;
            let inc = (holder_amt as u128)
                .checked_mul(REWARD_INDEX_PRECISION)
                .ok_or(LaunchError::MathOverflow)?
                .checked_div(mon.total_share_units)
                .ok_or(LaunchError::MathOverflow)?;
            dist.cumulative_reward_per_share = dist
                .cumulative_reward_per_share
                .checked_add(inc)
                .ok_or(LaunchError::MathOverflow)?;
            dist.total_funded = dist
                .total_funded
                .checked_add(holder_amt as u128)
                .ok_or(LaunchError::MathOverflow)?;
            dist.last_distribution_slot = Clock::get()?.slot;
            emit!(HolderRewardsFunded {
                launch: dist.launch,
                amount: holder_amt,
                reward_mint: dist.reward_mint,
                cumulative_reward_per_share: dist.cumulative_reward_per_share,
                distribution_epoch: dist.distribution_epoch,
                slot: Clock::get()?.slot,
            });
        }

        emit!(PlatformRevenueCollected {
            launch: launch_k,
            amount: platform_amt,
            platform_wallet: CANONICAL_PLATFORM_WALLET,
            fee_mint: qm,
            slot,
        });

        Ok(())
    }

    pub fn fund_holder_rewards_from_vault(
        ctx: Context<FundHolderRewardsFromVault>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, LaunchError::ZeroSplitAmount);
        let mon = &ctx.accounts.launch_monetization;
        require_keys_eq!(mon.reward_mint, ctx.accounts.reward_mint.key());
        require!(mon.total_share_units > 0, LaunchError::ZeroShareUnits);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder_token.to_account_info(),
                    to: ctx.accounts.holder_vault_token.to_account_info(),
                    authority: ctx.accounts.funder.to_account_info(),
                },
            ),
            amount,
        )?;

        let dist = &mut ctx.accounts.holder_reward_distributor;
        let inc = (amount as u128)
            .checked_mul(REWARD_INDEX_PRECISION)
            .ok_or(LaunchError::MathOverflow)?
            .checked_div(mon.total_share_units)
            .ok_or(LaunchError::MathOverflow)?;
        dist.cumulative_reward_per_share = dist
            .cumulative_reward_per_share
            .checked_add(inc)
            .ok_or(LaunchError::MathOverflow)?;
        dist.total_funded = dist
            .total_funded
            .checked_add(amount as u128)
            .ok_or(LaunchError::MathOverflow)?;
        dist.last_distribution_slot = Clock::get()?.slot;

        let slot = Clock::get()?.slot;
        emit!(HolderRewardsFunded {
            launch: dist.launch,
            amount,
            reward_mint: dist.reward_mint,
            cumulative_reward_per_share: dist.cumulative_reward_per_share,
            distribution_epoch: dist.distribution_epoch,
            slot,
        });
        Ok(())
    }

    pub fn claim_holder_rewards(ctx: Context<ClaimHolderRewards>) -> Result<()> {
        let st = &ctx.accounts.launch_state;
        require!(
            st.lifecycle >= LC_TRADING_ACTIVE && st.lifecycle <= LC_FINALIZED,
            LaunchError::HolderClaimLifecycle
        );
        let mon = &ctx.accounts.launch_monetization;
        require_keys_eq!(mon.reward_mint, ctx.accounts.reward_mint.key());
        require_keys_eq!(mon.launch, ctx.accounts.launch_state.key());

        let cp = &mut ctx.accounts.claim_position;
        if cp.launch == Pubkey::default() {
            cp.launch = ctx.accounts.launch_state.key();
            cp.asset = ctx.accounts.mint_receipt.asset;
            cp.reward_cursor = 0;
            cp.total_claimed = 0;
            cp.last_claim_slot = 0;
            cp.last_reward_epoch = 0;
            cp.claimed_this_epoch = 0;
            cp.bump = ctx.bumps.claim_position;
        }

        let gp = &ctx.accounts.genesis_pass_token;
        require_keys_eq!(gp.mint, ctx.accounts.mint_receipt.asset);
        require_keys_eq!(gp.owner, ctx.accounts.beneficiary.key());
        require!(gp.amount >= 1, LaunchError::MissingGenesisPass);

        let mr = &ctx.accounts.mint_receipt;
        require_keys_eq!(mr.launch, ctx.accounts.launch_state.key());
        require_keys_eq!(mr.owner, ctx.accounts.beneficiary.key());

        let shares = mr.allocation as u128;
        let dist = &mut ctx.accounts.holder_reward_distributor;
        require_keys_eq!(cp.launch, ctx.accounts.launch_state.key());
        require_keys_eq!(cp.asset, mr.asset);

        let claimable = claimable_rewards_floor(
            shares,
            dist.cumulative_reward_per_share,
            cp.reward_cursor,
        )?;
        require!(claimable > 0, LaunchError::NothingToClaimHolder);

        let (expected_cfg, _) = Pubkey::find_program_address(
            &[b"creator_reward_cfg", st.key().as_ref()],
            ctx.program_id,
        );

        let current_slot = Clock::get()?.slot;
        let mut paced_raw = claimable;
        let mut applied_cfg = false;
        let mut new_last_epoch = cp.last_reward_epoch;
        let mut new_claimed_epoch = cp.claimed_this_epoch;
        if !ctx.remaining_accounts.is_empty() {
            let ai = &ctx.remaining_accounts[0];
            if *ai.key != Pubkey::default() {
                require_keys_eq!(*ai.key, expected_cfg, LaunchError::BadCreatorRewardConfigAccount);
                require_keys_eq!(*ai.owner, *ctx.program_id, LaunchError::BadLaunchBinding);
                let cfg = {
                    let borrowed = ai.try_borrow_data()?;
                    let mut rd: &[u8] = &borrowed;
                    CreatorRewardConfig::try_deserialize(&mut rd)?
                };
                if cfg.config_initialized {
                    require_keys_eq!(cfg.launch, st.key());
                    (paced_raw, new_last_epoch, new_claimed_epoch) = apply_holder_claim_pacing(
                        claimable,
                        current_slot,
                        dist.distribution_epoch,
                        cfg.schedule_anchor_slot,
                        cfg.claim_start_delay_slots,
                        cfg.vesting_duration_slots,
                        cfg.transfer_cooldown_slots,
                        cfg.max_claim_per_epoch,
                        cp.last_claim_slot,
                        cp.last_reward_epoch,
                        cp.claimed_this_epoch,
                    )?;
                    applied_cfg = true;
                }
            }
        }

        require!(paced_raw > 0, LaunchError::NothingToClaimHolder);

        let vault_bal = ctx.accounts.holder_vault_token.amount;
        let pay = paced_raw.min(vault_bal);
        require!(pay > 0, LaunchError::InsufficientRewardVault);

        let holder_auth = ctx.accounts.holder_rw_vault.to_account_info();
        let bump = ctx.bumps.holder_rw_vault;
        let col = ctx.accounts.launch_state.collection_mint;
        let hw_seeds: [&[u8]; 3] = [b"holder_rw_vault", col.as_ref(), &[bump]];
        let hw_signer = &[&hw_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.holder_vault_token.to_account_info(),
                    to: ctx.accounts.beneficiary_reward_token.to_account_info(),
                    authority: holder_auth,
                },
                hw_signer,
            ),
            pay,
        )?;

        cp.reward_cursor = dist.cumulative_reward_per_share;
        cp.total_claimed = cp
            .total_claimed
            .checked_add(pay as u128)
            .ok_or(LaunchError::MathOverflow)?;
        cp.last_claim_slot = current_slot;
        if applied_cfg {
            cp.last_reward_epoch = new_last_epoch;
            cp.claimed_this_epoch = new_claimed_epoch;
        }
        dist.total_claimed = dist
            .total_claimed
            .checked_add(pay as u128)
            .ok_or(LaunchError::MathOverflow)?;

        let slot = Clock::get()?.slot;
        emit!(HolderRewardsClaimed {
            launch: ctx.accounts.launch_state.key(),
            beneficiary: ctx.accounts.beneficiary.key(),
            asset: mr.asset,
            amount: pay,
            new_claimer_total_claimed: cp.total_claimed,
            reward_cursor: cp.reward_cursor,
            slot,
        });
        if applied_cfg {
            emit!(NFTClaimParametersApplied {
                launch: ctx.accounts.launch_state.key(),
                beneficiary: ctx.accounts.beneficiary.key(),
                asset: mr.asset,
                raw_claimable: claimable,
                paced_claimable: paced_raw,
                distribution_epoch: dist.distribution_epoch,
                slot,
            });
        }
        Ok(())
    }

    /// One-time per collection: PDA treasury + creator escrow vault for genesis mint-tax leg.
    pub fn init_launch_treasury(ctx: Context<InitLaunchTreasury>) -> Result<()> {
        let st = &ctx.accounts.launch_state;
        let lt = &mut ctx.accounts.launch_treasury;
        lt.launch = st.key();
        lt.quote_mint = ctx.accounts.quote_mint.key();
        lt.creator_vault = ctx.accounts.creator_vault.key();
        lt.bump = ctx.bumps.launch_treasury;
        Ok(())
    }

    /// Genesis mint payment: user pays `mint_price + 7% tax`; tax split 80% platform / 20% creator escrow; `mint_price` to `base_destination`.
    pub fn mint_nft(ctx: Context<MintNft>, mint_price: u64, asset_mint: Pubkey) -> Result<()> {
        let st = &ctx.accounts.launch_state;
        require!(st.lifecycle == LC_MINT_ACTIVE, LaunchError::BadLifecycle);
        require_eq!(mint_price, st.expected_quote_per_mint, LaunchError::BadDepositAmount);
        require_keys_eq!(
            ctx.accounts.quote_mint.key(),
            ctx.accounts.platform_fee_config.fee_token_mint,
            LaunchError::BadFeeMint
        );
        require_keys_eq!(
            ctx.accounts.launch_treasury.quote_mint,
            ctx.accounts.quote_mint.key(),
            LaunchError::BadFeeMint
        );

        let (mint_tax, platform_share, creator_share) = split_genesis_mint_tax(mint_price)?;
        let total_out = mint_price
            .checked_add(mint_tax)
            .ok_or(LaunchError::MathOverflow)?;
        require!(
            ctx.accounts.user_quote.amount >= total_out,
            LaunchError::InsufficientUserQuote
        );

        let tok = ctx.accounts.token_program.to_account_info();
        let user_ai = ctx.accounts.user.to_account_info();
        let from = ctx.accounts.user_quote.to_account_info();

        token::transfer(
            CpiContext::new(
                tok.clone(),
                Transfer {
                    from: from.clone(),
                    to: ctx.accounts.platform_quote.to_account_info(),
                    authority: user_ai.clone(),
                },
            ),
            platform_share,
        )?;
        token::transfer(
            CpiContext::new(
                tok.clone(),
                Transfer {
                    from: from.clone(),
                    to: ctx.accounts.creator_vault.to_account_info(),
                    authority: user_ai.clone(),
                },
            ),
            creator_share,
        )?;
        token::transfer(
            CpiContext::new(
                tok,
                Transfer {
                    from,
                    to: ctx.accounts.base_destination.to_account_info(),
                    authority: user_ai,
                },
            ),
            mint_price,
        )?;

        let slot = Clock::get()?.slot;
        let qm = ctx.accounts.quote_mint.key();
        emit!(NFTMintTaxCollected {
            launch: st.key(),
            mint_price,
            mint_tax,
            quote_mint: qm,
            slot,
        });
        emit!(NFTMintPlatformShareTransferred {
            launch: st.key(),
            amount: platform_share,
            platform_wallet: CANONICAL_PLATFORM_WALLET,
            quote_mint: qm,
            slot,
        });
        emit!(NFTMintCreatorShareAllocated {
            launch: st.key(),
            amount: creator_share,
            creator_vault: ctx.accounts.creator_vault.key(),
            quote_mint: qm,
            slot,
        });
        emit!(NFTMintExecuted {
            launch: st.key(),
            mint_price,
            base_destination: ctx.accounts.base_destination.key(),
            asset_mint,
            slot,
        });
        Ok(())
    }

    /// Creator pulls escrowed quote from `LaunchTreasury.creator_vault` (PDA-signed).
    pub fn claim_creator_rewards(ctx: Context<ClaimCreatorRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, LaunchError::ZeroSplitAmount);
        let st = &ctx.accounts.launch_state;
        require_keys_eq!(ctx.accounts.authority.key(), st.authority);
        require!(
            st.lifecycle >= LC_MINT_ACTIVE && st.lifecycle <= LC_FINALIZED,
            LaunchError::CreatorClaimLifecycle
        );

        let bump = [ctx.accounts.launch_treasury.bump];
        let col = st.collection_mint;
        let seeds: [&[u8]; 3] = [b"launch_treasury", col.as_ref(), bump.as_ref()];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_vault.to_account_info(),
                    to: ctx.accounts.destination_quote.to_account_info(),
                    authority: ctx.accounts.launch_treasury.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        Ok(())
    }

    pub fn treasury_withdraw(ctx: Context<TreasuryWithdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, LaunchError::ZeroSplitAmount);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury_token.to_account_info(),
                    to: ctx.accounts.destination_token.to_account_info(),
                    authority: ctx.accounts.treasury_signer.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(TreasuryWithdrawal {
            vault_owner: ctx.accounts.treasury_token.owner,
            destination: ctx.accounts.destination_token.owner,
            amount,
            mint: ctx.accounts.treasury_token.mint,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    pub fn advance_reward_epoch(ctx: Context<AdvanceRewardEpoch>) -> Result<()> {
        let d = &mut ctx.accounts.holder_reward_distributor;
        let old = d.distribution_epoch;
        d.distribution_epoch = d
            .distribution_epoch
            .checked_add(1)
            .ok_or(LaunchError::MathOverflow)?;
        emit!(RewardEpochAdvanced {
            launch: d.launch,
            old_epoch: old,
            new_epoch: d.distribution_epoch,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }
}

// ── vesting math ───────────────────────────────────────────────────────────

fn vested_amount(
    allocation: u64,
    vesting_start_ts: i64,
    cliff_seconds: u64,
    vesting_seconds: u64,
) -> Result<u64> {
    if vesting_start_ts == 0 {
        return Ok(0);
    }
    let now = Clock::get()?.unix_timestamp;
    let cliff_end = vesting_start_ts
        .checked_add(cliff_seconds as i64)
        .ok_or(LaunchError::MathOverflow)?;
    if now < cliff_end {
        return Ok(0);
    }
    let elapsed = now
        .saturating_sub(cliff_end)
        .min(vesting_seconds as i64) as u128;
    let num = (allocation as u128)
        .checked_mul(elapsed)
        .ok_or(LaunchError::MathOverflow)?;
    let den = vesting_seconds as u128;
    let vested = num
        .checked_div(den)
        .ok_or(LaunchError::MathOverflow)?;
    u64::try_from(vested).map_err(|_| LaunchError::MathOverflow.into())
}

// ── accounts: initialize ───────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeLaunch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + LaunchState::INIT_SPACE,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(mut)]
    pub project_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = project_mint,
        associated_token::authority = launch_state,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct SetAlphaVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", launch_state.collection_mint.as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Account<'info, LaunchState>,
}

#[derive(Accounts)]
pub struct AdvanceLifecycle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", launch_state.collection_mint.as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Account<'info, LaunchState>,
}

#[derive(Accounts)]
#[instruction(deposit_lamports: u64, asset_mint: Pubkey, vault_tier: u8, deposit_seq: u64)]
pub struct RecordGenesisParticipation<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
        constraint = launch_state.lifecycle == LC_MINT_ACTIVE @ LaunchError::BadLifecycle,
        constraint = deposit_lamports == launch_state.expected_quote_per_mint @ LaunchError::BadDepositAmount,
        constraint = deposit_seq == launch_state.deposit_seq @ LaunchError::BadDepositSeq,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        init,
        payer = user,
        space = 8 + DepositReceipt::INIT_SPACE,
        seeds = [b"deposit", launch_state.key().as_ref(), deposit_seq.to_le_bytes().as_ref()],
        bump
    )]
    pub deposit_receipt: Account<'info, DepositReceipt>,
    #[account(
        init,
        payer = user,
        space = 8 + MintReceipt::INIT_SPACE,
        seeds = [b"mint_rcpt", launch_state.key().as_ref(), asset_mint.as_ref()],
        bump
    )]
    pub mint_receipt: Account<'info, MintReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    #[account(
        seeds = [b"launch", launch_state.collection_mint.as_ref()],
        bump = launch_state.bump,
        constraint = launch_state.lifecycle == LC_CLAIM_ACTIVE @ LaunchError::BadLifecycle,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        mut,
        seeds = [b"mint_rcpt", launch_state.key().as_ref(), mint_receipt.asset.as_ref()],
        bump = mint_receipt.bump,
        constraint = mint_receipt.owner == beneficiary.key(),
        constraint = mint_receipt.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub mint_receipt: Account<'info, MintReceipt>,
    #[account(mut)]
    pub project_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = project_mint,
        associated_token::authority = launch_state,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = project_mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_token: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct InitializePlatformFeeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformFeeConfig::INIT_SPACE,
        seeds = [b"platform_fee_config"],
        bump
    )]
    pub platform_fee_config: Account<'info, PlatformFeeConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatformFeeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"platform_fee_config"],
        bump = platform_fee_config.bump
    )]
    pub platform_fee_config: Account<'info, PlatformFeeConfig>,
}

#[derive(Accounts)]
pub struct SetPlatformPaused<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"platform_fee_config"],
        bump = platform_fee_config.bump
    )]
    pub platform_fee_config: Account<'info, PlatformFeeConfig>,
}

#[derive(Accounts)]
pub struct InitLaunchTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        init,
        payer = authority,
        space = 8 + LaunchTreasury::INIT_SPACE,
        seeds = [b"launch_treasury", collection_mint.key().as_ref()],
        bump
    )]
    pub launch_treasury: Account<'info, LaunchTreasury>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = quote_mint,
        associated_token::authority = launch_treasury,
    )]
    pub creator_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(mint_price: u64, asset_mint: Pubkey)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Genesis Pass collection mint — only used as a seed for `launch_state` / treasury PDAs (binding enforced on `launch_state`).
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
        constraint = launch_state.lifecycle == LC_MINT_ACTIVE @ LaunchError::BadLifecycle,
    )]
    pub launch_state: Box<Account<'info, LaunchState>>,
    #[account(
        seeds = [b"launch_treasury", collection_mint.key().as_ref()],
        bump = launch_treasury.bump,
        constraint = launch_treasury.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_treasury: Box<Account<'info, LaunchTreasury>>,
    #[account(mut)]
    pub quote_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [b"platform_fee_config"],
        bump = platform_fee_config.bump,
    )]
    pub platform_fee_config: Box<Account<'info, PlatformFeeConfig>>,
    /// CHECK: canonical platform wallet — immutable global receiver for the platform tax leg.
    #[account(address = CANONICAL_PLATFORM_WALLET)]
    pub platform_wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = quote_mint,
        associated_token::authority = platform_wallet,
    )]
    pub platform_quote: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = creator_vault.key() == launch_treasury.creator_vault @ LaunchError::BadTreasuryOwner,
        constraint = creator_vault.mint == quote_mint.key() @ LaunchError::BadFeeMint,
        constraint = creator_vault.owner == launch_treasury.key() @ LaunchError::BadTreasuryOwner,
    )]
    pub creator_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_quote.owner == user.key(),
        constraint = user_quote.mint == quote_mint.key() @ LaunchError::BadFeeMint,
    )]
    pub user_quote: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = launch_state,
    )]
    pub base_destination: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ClaimCreatorRewards<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
        has_one = authority,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        seeds = [b"launch_treasury", collection_mint.key().as_ref()],
        bump = launch_treasury.bump,
        constraint = launch_treasury.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_treasury: Account<'info, LaunchTreasury>,
    #[account(
        mut,
        constraint = creator_vault.key() == launch_treasury.creator_vault @ LaunchError::BadTreasuryOwner,
        constraint = creator_vault.mint == quote_mint.key() @ LaunchError::BadFeeMint,
        constraint = creator_vault.owner == launch_treasury.key() @ LaunchError::BadTreasuryOwner,
    )]
    pub creator_vault: Account<'info, TokenAccount>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = destination_quote.owner == authority.key(),
        constraint = destination_quote.mint == quote_mint.key() @ LaunchError::BadFeeMint,
    )]
    pub destination_quote: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitLaunchMonetization<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        init,
        payer = authority,
        space = 8 + LaunchMonetization::INIT_SPACE,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump
    )]
    pub launch_monetization: Account<'info, LaunchMonetization>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitHolderRewardDistributor<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        mut,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Account<'info, LaunchMonetization>,
    #[account(
        init,
        payer = authority,
        space = 8 + HolderRewardDistributor::INIT_SPACE,
        seeds = [b"holder_rewards", launch_state.key().as_ref()],
        bump
    )]
    pub holder_reward_distributor: Account<'info, HolderRewardDistributor>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterMonetizationShare<'info> {
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        seeds = [b"mint_rcpt", launch_state.key().as_ref(), mint_receipt.asset.as_ref()],
        bump = mint_receipt.bump,
        constraint = mint_receipt.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub mint_receipt: Account<'info, MintReceipt>,
    #[account(
        mut,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Account<'info, LaunchMonetization>,
    #[account(
        init,
        payer = payer,
        space = 8 + ShareRegistration::INIT_SPACE,
        seeds = [b"share_reg", launch_state.key().as_ref(), mint_receipt.asset.as_ref()],
        bump
    )]
    pub share_registration: Account<'info, ShareRegistration>,
    #[account(
        mut,
        constraint = payer.key() == mint_receipt.owner || payer.key() == launch_state.authority @ LaunchError::UnauthorizedShareRegistrar,
    )]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ToggleTax<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        mut,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Account<'info, LaunchMonetization>,
}

#[derive(Accounts)]
pub struct CollectPlatformFee<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub meteora_program: UncheckedAccount<'info>,
    /// CHECK: must match `launch_monetization.damm_pool` (Meteora pool address).
    pub damm_pool: UncheckedAccount<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Box<Account<'info, LaunchState>>,
    #[account(
        mut,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Box<Account<'info, LaunchMonetization>>,
    #[account(
        mut,
        seeds = [b"holder_rewards", launch_state.key().as_ref()],
        bump = holder_reward_distributor.bump,
        constraint = holder_reward_distributor.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
        constraint = holder_reward_distributor.reward_mint == fee_mint.key() @ LaunchError::BadFeeMint,
    )]
    pub holder_reward_distributor: Box<Account<'info, HolderRewardDistributor>>,
    #[account(
        seeds = [b"platform_fee_config"],
        bump = platform_fee_config.bump,
    )]
    pub platform_fee_config: Box<Account<'info, PlatformFeeConfig>>,
    #[account(mut)]
    pub fee_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = fee_mint,
        associated_token::authority = launch_state,
    )]
    pub fee_buffer: Box<Account<'info, TokenAccount>>,
    /// CHECK: must match `platform_fee_config.platform_wallet` (canonical platform receiver).
    pub platform_wallet: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = fee_mint,
        associated_token::authority = platform_wallet,
        constraint = platform_wallet.key() == platform_fee_config.platform_wallet @ LaunchError::BadTreasuryOwner,
    )]
    pub platform_dest: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"launch_treasury", collection_mint.key().as_ref()],
        bump = launch_treasury.bump,
        constraint = launch_treasury.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_treasury: Box<Account<'info, LaunchTreasury>>,
    #[account(
        mut,
        constraint = creator_vault.key() == launch_treasury.creator_vault @ LaunchError::BadTreasuryOwner,
        constraint = creator_vault.mint == fee_mint.key() @ LaunchError::BadFeeMint,
        constraint = creator_vault.owner == launch_treasury.key() @ LaunchError::BadTreasuryOwner,
    )]
    pub creator_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: holder reward vault authority PDA.
    #[account(
        seeds = [b"holder_rw_vault", collection_mint.key().as_ref()],
        bump,
    )]
    pub holder_rw_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = fee_mint,
        associated_token::authority = holder_rw_vault,
    )]
    pub holder_dest: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FundHolderRewardsFromVault<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        mut,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Account<'info, LaunchMonetization>,
    #[account(
        mut,
        seeds = [b"holder_rewards", launch_state.key().as_ref()],
        bump = holder_reward_distributor.bump,
        constraint = holder_reward_distributor.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub holder_reward_distributor: Account<'info, HolderRewardDistributor>,
    #[account(mut)]
    pub reward_mint: Account<'info, Mint>,
    #[account(mut, constraint = funder_token.owner == funder.key())]
    pub funder_token: Account<'info, TokenAccount>,
    /// CHECK: holder_rw_vault PDA
    #[account(
        seeds = [b"holder_rw_vault", collection_mint.key().as_ref()],
        bump,
    )]
    pub holder_rw_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = holder_rw_vault,
    )]
    pub holder_vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct InitializeCreatorRewardConfig<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
        constraint = launch_state.authority == creator.key() @ LaunchError::Unauthorized,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        init,
        payer = creator,
        space = 8 + CreatorRewardConfig::INIT_SPACE,
        seeds = [b"creator_reward_cfg", launch_state.key().as_ref()],
        bump
    )]
    pub creator_reward_config: Account<'info, CreatorRewardConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCreatorRewardConfig<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
        constraint = launch_state.authority == creator.key() @ LaunchError::Unauthorized,
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        mut,
        seeds = [b"creator_reward_cfg", launch_state.key().as_ref()],
        bump = creator_reward_config.bump,
        constraint = creator_reward_config.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub creator_reward_config: Account<'info, CreatorRewardConfig>,
}

#[derive(Accounts)]
pub struct FundCreatorNftIncentives<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
        constraint = launch_state.authority == authority.key() @ LaunchError::Unauthorized,
    )]
    pub launch_state: Box<Account<'info, LaunchState>>,
    #[account(
        seeds = [b"creator_reward_cfg", launch_state.key().as_ref()],
        bump = creator_reward_config.bump,
        constraint = creator_reward_config.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub creator_reward_config: Box<Account<'info, CreatorRewardConfig>>,
    #[account(
        mut,
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Box<Account<'info, LaunchMonetization>>,
    #[account(
        mut,
        seeds = [b"holder_rewards", launch_state.key().as_ref()],
        bump = holder_reward_distributor.bump,
        constraint = holder_reward_distributor.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub holder_reward_distributor: Box<Account<'info, HolderRewardDistributor>>,
    #[account(mut)]
    pub reward_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [b"creator_treasury", collection_mint.key().as_ref()],
        bump,
    )]
    pub creator_treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = creator_treasury,
    )]
    pub creator_treasury_token: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"holder_rw_vault", collection_mint.key().as_ref()],
        bump,
    )]
    pub holder_rw_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = holder_rw_vault,
    )]
    pub holder_vault_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ClaimHolderRewards<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump,
    )]
    pub launch_state: Box<Account<'info, LaunchState>>,
    #[account(
        seeds = [b"launch_mon", collection_mint.key().as_ref()],
        bump = launch_monetization.bump,
        constraint = launch_monetization.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub launch_monetization: Box<Account<'info, LaunchMonetization>>,
    #[account(
        mut,
        seeds = [b"holder_rewards", launch_state.key().as_ref()],
        bump = holder_reward_distributor.bump,
        constraint = holder_reward_distributor.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub holder_reward_distributor: Box<Account<'info, HolderRewardDistributor>>,
    #[account(
        mut,
        seeds = [b"mint_rcpt", launch_state.key().as_ref(), mint_receipt.asset.as_ref()],
        bump = mint_receipt.bump,
    )]
    pub mint_receipt: Box<Account<'info, MintReceipt>>,
    #[account(
        init_if_needed,
        payer = beneficiary,
        space = 8 + ClaimPosition::INIT_SPACE,
        seeds = [b"claim_position", launch_state.key().as_ref(), mint_receipt.asset.as_ref()],
        bump
    )]
    pub claim_position: Box<Account<'info, ClaimPosition>>,
    #[account(
        constraint = genesis_pass_token.mint == mint_receipt.asset @ LaunchError::BadGenesisPass,
        constraint = genesis_pass_token.owner == beneficiary.key() @ LaunchError::BadGenesisPass,
        constraint = genesis_pass_token.amount >= 1 @ LaunchError::MissingGenesisPass,
    )]
    pub genesis_pass_token: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"holder_rw_vault", collection_mint.key().as_ref()],
        bump,
    )]
    pub holder_rw_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = holder_rw_vault,
    )]
    pub holder_vault_token: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub reward_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = reward_mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_reward_token: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct TreasuryWithdraw<'info> {
    #[account(
        mut,
        constraint = authority.key() == platform_fee_config.authority @ LaunchError::Unauthorized,
    )]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"platform_fee_config"],
        bump = platform_fee_config.bump,
    )]
    pub platform_fee_config: Account<'info, PlatformFeeConfig>,
    #[account(
        constraint = treasury_signer.key() == treasury_token.owner @ LaunchError::BadTreasuryOwner,
    )]
    pub treasury_signer: Signer<'info>,
    #[account(mut)]
    pub treasury_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdvanceRewardEpoch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collection_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"launch", collection_mint.key().as_ref()],
        bump = launch_state.bump
    )]
    pub launch_state: Account<'info, LaunchState>,
    #[account(
        mut,
        seeds = [b"holder_rewards", launch_state.key().as_ref()],
        bump = holder_reward_distributor.bump,
        constraint = holder_reward_distributor.launch == launch_state.key() @ LaunchError::BadLaunchBinding,
    )]
    pub holder_reward_distributor: Account<'info, HolderRewardDistributor>,
}

// ── state ───────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct LaunchState {
    pub authority: Pubkey,
    pub collection_mint: Pubkey,
    pub project_mint: Pubkey,
    pub alpha_vault: Pubkey,
    pub vesting_start_ts: i64,
    pub cliff_seconds: u64,
    pub vesting_seconds: u64,
    pub lifecycle: u8,
    pub expected_quote_per_mint: u64,
    pub tokens_per_quote_num: u64,
    pub tokens_per_quote_den: u64,
    pub deposit_seq: u64,
    pub genesis_supply: u64,
    pub trading_live_at: i64,
    pub slice_b_reserve_bps: u16,
    pub slice_b_creator_of_reserve_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DepositReceipt {
    pub launch: Pubkey,
    pub depositor: Pubkey,
    pub seq: u64,
    pub lamports: u64,
    pub slot: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MintReceipt {
    pub launch: Pubkey,
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub allocation: u64,
    pub claimed: u64,
    pub vault_tier: u8,
    pub entry_ts: i64,
    pub bump: u8,
}

// ── events ─────────────────────────────────────────────────────────────────

#[event]
pub struct GenesisSellout {
    pub launch: Pubkey,
    pub trading_live_at: i64,
    pub deposit_seq: u64,
}

#[event]
pub struct LaunchInitialized {
    pub launch: Pubkey,
    pub collection_mint: Pubkey,
    pub project_mint: Pubkey,
    pub lifecycle: u8,
    pub expected_quote_per_mint: u64,
}

#[event]
pub struct AlphaVaultLinked {
    pub launch: Pubkey,
    pub alpha_vault: Pubkey,
    pub lifecycle: u8,
}

#[event]
pub struct LifecycleAdvanced {
    pub launch: Pubkey,
    pub lifecycle: u8,
}

#[event]
pub struct GenesisParticipationRecorded {
    pub launch: Pubkey,
    pub depositor: Pubkey,
    pub seq: u64,
    pub lamports: u64,
    pub asset: Pubkey,
    pub allocation: u64,
    pub vault_tier: u8,
}

#[event]
pub struct TrancheClaimed {
    pub launch: Pubkey,
    pub asset: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
    pub new_claimed_total: u64,
}

#[error_code]
pub enum LaunchError {
    #[msg("vesting duration must be > 0")]
    ZeroVesting,
    #[msg("denominator must be > 0")]
    ZeroDenominator,
    #[msg("nothing unlocked yet")]
    NothingToClaim,
    #[msg("vault has no spendable balance")]
    VaultEmpty,
    #[msg("math overflow")]
    MathOverflow,
    #[msg("mint receipt does not match launch")]
    BadLaunchBinding,
    #[msg("slice B / creator split bps invalid")]
    BadSliceBps,
    #[msg("invalid lifecycle for this instruction")]
    BadLifecycle,
    #[msg("invalid lifecycle transition")]
    BadTransition,
    #[msg("holder rewards unavailable in this lifecycle")]
    HolderClaimLifecycle,
    #[msg("creator reward claim unavailable in this lifecycle")]
    CreatorClaimLifecycle,
    #[msg("user quote token balance insufficient for mint price plus mint tax")]
    InsufficientUserQuote,
    #[msg("deposit must match configured quote per mint")]
    BadDepositAmount,
    #[msg("deposit sequence mismatch")]
    BadDepositSeq,
    #[msg("invalid vault pubkey")]
    BadVault,
    #[msg("fee bps invariant violated")]
    BpsInvariant,
    #[msg("tax bps too high")]
    TaxTooHigh,
    #[msg("platform fee config paused")]
    Paused,
    #[msg("Meteora program id mismatch")]
    BadMeteoraProgram,
    #[msg("damm pool mismatch")]
    BadDammPool,
    #[msg("fee mint mismatch")]
    BadFeeMint,
    #[msg("zero split amount")]
    ZeroSplitAmount,
    #[msg("zero share units registered")]
    ZeroShareUnits,
    #[msg("nothing to claim for holder rewards")]
    NothingToClaimHolder,
    #[msg("insufficient reward vault balance")]
    InsufficientRewardVault,
    #[msg("must hold genesis pass token")]
    MissingGenesisPass,
    #[msg("genesis pass token binding invalid")]
    BadGenesisPass,
    #[msg("must register genesis shares before routing holder fee slice into reward index")]
    HolderFundingRequiresShares,
    #[msg("only pass owner or launch authority may register monetization share")]
    UnauthorizedShareRegistrar,
    #[msg("trading tax settlement disabled for this launch")]
    TradingTaxDisabled,
    #[msg("launch fee buffer has less than computed trading tax")]
    InsufficientFeeBuffer,
    #[msg("treasury owner mismatch")]
    BadTreasuryOwner,
    #[msg("unauthorized")]
    Unauthorized,
    #[msg("creator reward config PDA mismatch")]
    BadCreatorRewardConfigAccount,
    #[msg("creator reward config not initialized")]
    CreatorRewardConfigUninitialized,
    #[msg("invalid creator reward config immutability vs lifecycle")]
    CreatorRewardConfigBadImmutable,
    #[msg("creator reward config is locked")]
    CreatorRewardConfigLocked,
    #[msg("holder claim cooldown (creator pacing) not elapsed")]
    HolderClaimCooldown,
    #[msg("creator NFT incentives disabled (creator_reward_share_bps is zero)")]
    CreatorIncentiveDisabled,
}
