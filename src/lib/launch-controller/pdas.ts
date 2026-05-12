import { PublicKey } from "@solana/web3.js";

import { LAUNCH_CONTROLLER_PROGRAM_ID } from "./constants";

const LAUNCH_SEED = Buffer.from("launch");
const DEPOSIT_SEED = Buffer.from("deposit");
const MINT_RCPT_SEED = Buffer.from("mint_rcpt");

export function launchControllerProgramId(): PublicKey {
  return new PublicKey(LAUNCH_CONTROLLER_PROGRAM_ID);
}

/** PDA for [`LaunchState`](../../anchor/programs/launch-controller/src/lib.rs) + vault signer. */
export function launchStatePda(collectionMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LAUNCH_SEED, collectionMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** On-chain deposit receipt (Option A — financial truth). */
export function depositReceiptPda(launchState: PublicKey, depositSeq: bigint): [PublicKey, number] {
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64LE(depositSeq);
  return PublicKey.findProgramAddressSync(
    [DEPOSIT_SEED, launchState.toBytes(), seqBuf],
    launchControllerProgramId(),
  );
}

/** Per-NFT mint receipt (allocation + vesting cursor). */
export function mintReceiptPda(launchState: PublicKey, assetMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINT_RCPT_SEED, launchState.toBytes(), assetMint.toBytes()],
    launchControllerProgramId(),
  );
}

const LAUNCH_MON_SEED = Buffer.from("launch_mon");
const HOLDER_REWARDS_SEED = Buffer.from("holder_rewards");
const CLAIM_POSITION_SEED = Buffer.from("claim_position");
const SHARE_REG_SEED = Buffer.from("share_reg");
const HOLDER_RW_VAULT_SEED = Buffer.from("holder_rw_vault");
const CREATOR_TREASURY_SEED = Buffer.from("creator_treasury");
const LAUNCH_TREASURY_SEED = Buffer.from("launch_treasury");
const PLATFORM_FEE_CONFIG_SEED = Buffer.from("platform_fee_config");
const CREATOR_REWARD_CFG_SEED = Buffer.from("creator_reward_cfg");

/** Meteora DAMM v2 program id — must match `monetization::METEORA_CP_AMM_PROGRAM_ID`. */
export const METEORA_CP_AMM_PROGRAM_ID = new PublicKey("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");

/** Per-launch monetization extension (tax fields + DAMM pool + reward mint). */
export function launchMonetizationPda(collectionMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LAUNCH_MON_SEED, collectionMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** Holder reward index account (`HolderRewardDistributor`). */
export function holderRewardDistributorPda(launchState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOLDER_REWARDS_SEED, launchState.toBytes()],
    launchControllerProgramId(),
  );
}

/** Per-pass reward cursor (`ClaimPosition`). */
export function claimPositionPda(launchState: PublicKey, assetMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CLAIM_POSITION_SEED, launchState.toBytes(), assetMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** One-time share registration marker. */
export function shareRegistrationPda(launchState: PublicKey, assetMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SHARE_REG_SEED, launchState.toBytes(), assetMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** PDA that owns the holder reward vault ATA. */
export function holderRwVaultPda(collectionMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOLDER_RW_VAULT_SEED, collectionMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** Creator treasury PDA (fee split destination). */
export function creatorTreasuryPda(collectionMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CREATOR_TREASURY_SEED, collectionMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** Per-launch treasury PDA (`LaunchTreasury`); owns `creator_vault` for genesis mint-tax escrow. */
export function launchTreasuryPda(collectionMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LAUNCH_TREASURY_SEED, collectionMint.toBytes()],
    launchControllerProgramId(),
  );
}

/** PDA for per-launch `CreatorRewardConfig` (holder claim pacing + incentive metadata). */
export function creatorRewardConfigPda(launchState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CREATOR_REWARD_CFG_SEED, launchState.toBytes()],
    launchControllerProgramId(),
  );
}

/** Global platform fee config singleton. */
export function platformFeeConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PLATFORM_FEE_CONFIG_SEED], launchControllerProgramId());
}
