import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  type TransactionInstructionCtorFields,
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { MAX_SLICE_B_RESERVE_BPS } from "@/lib/launch/slice-b-reserve";
import {
  launchStatePda,
  depositReceiptPda,
  mintReceiptPda,
  launchMonetizationPda,
  holderRewardDistributorPda,
  claimPositionPda,
  shareRegistrationPda,
  holderRwVaultPda,
  creatorTreasuryPda,
  creatorRewardConfigPda,
  launchTreasuryPda,
  platformFeeConfigPda,
  METEORA_CP_AMM_PROGRAM_ID,
  launchControllerProgramId,
} from "./pdas";
import { CANONICAL_PLATFORM_WALLET } from "./constants";

// Anchor discriminator = first 8 bytes of sha256("global:<instruction_name>")
// precomputed from the current on-chain Rust.
const DISCRIMINATORS: Record<string, Buffer> = {
  initialize_launch: Buffer.from("5ac9dc8e70fd640d", "hex"),
  set_alpha_vault: Buffer.from("d7479bd7bb4480ab", "hex"),
  advance_lifecycle: Buffer.from("68a3c326e958cf78", "hex"),
  record_genesis_participation: Buffer.from("39ef528a7b978ad5", "hex"),
  collect_platform_fee: Buffer.from("9758acfa75b93bd1", "hex"),
  register_monetization_share: Buffer.from("846ce4d406f6f158", "hex"),
  fund_holder_rewards_from_vault: Buffer.from("be1f13408217770e", "hex"),
  claim_holder_rewards: Buffer.from("4fb68e9e6c7f78ae", "hex"),
  init_launch_treasury: Buffer.from("41c249f3501888d6", "hex"),
  mint_nft: Buffer.from("d33906a70fdb23fb", "hex"),
  claim_creator_rewards: Buffer.from("0ed7b1b5ddc17d55", "hex"),
  set_nft_holder_share_bps: Buffer.from("d4c3ff7144d065f8", "hex"),
  initialize_creator_reward_config: Buffer.from("3980bd2375ca0c10", "hex"),
  update_creator_reward_config: Buffer.from("5a9e8934da16f18d", "hex"),
  fund_creator_nft_incentives: Buffer.from("bd311286915dd642", "hex"),
};

function u64ToLe(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function assertU64(n: bigint, name: string) {
  if (n < 0n) throw new Error(`${name} must be non-negative`);
  const max = (1n << 64n) - 1n;
  if (n > max) throw new Error(`${name} exceeds u64`);
}

function u16ToLe(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function boolIxByte(v: boolean): Buffer {
  return Buffer.from([v ? 1 : 0]);
}

export async function buildInitializeLaunchIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  projectMint: PublicKey;
  cliffSeconds: bigint;
  vestingSeconds: bigint;
  expectedQuotePerMint: bigint;
  tokensPerQuoteNum: bigint;
  tokensPerQuoteDen: bigint;
  genesisSupply: bigint;
  sliceBReserveBps: number;
  sliceBCreatorOfReserveBps: number;
}): Promise<TransactionInstruction> {
  const programId = launchControllerProgramId();
  const [launchState, launchBump] = launchStatePda(args.collectionMint);
  void launchBump;

  assertU64(args.cliffSeconds, "cliffSeconds");
  assertU64(args.vestingSeconds, "vestingSeconds");
  assertU64(args.expectedQuotePerMint, "expectedQuotePerMint");
  assertU64(args.tokensPerQuoteNum, "tokensPerQuoteNum");
  assertU64(args.tokensPerQuoteDen, "tokensPerQuoteDen");
  assertU64(args.genesisSupply, "genesisSupply");
  if (args.sliceBReserveBps < 0 || args.sliceBReserveBps > MAX_SLICE_B_RESERVE_BPS) {
    throw new Error(`sliceBReserveBps must be 0–${MAX_SLICE_B_RESERVE_BPS} (0–${MAX_SLICE_B_RESERVE_BPS / 100}% of 1B).`);
  }
  if (args.sliceBCreatorOfReserveBps < 0 || args.sliceBCreatorOfReserveBps > 10_000) {
    throw new Error("sliceBCreatorOfReserveBps must be 0–10000.");
  }

  // `launch_state` is a PDA (off-curve); SPL ATA helpers require allowOwnerOffCurve.
  const vaultToken = getAssociatedTokenAddressSync(
    args.projectMint,
    launchState,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const data = Buffer.concat([
    DISCRIMINATORS.initialize_launch,
    u64ToLe(args.cliffSeconds),
    u64ToLe(args.vestingSeconds),
    u64ToLe(args.expectedQuotePerMint),
    u64ToLe(args.tokensPerQuoteNum),
    u64ToLe(args.tokensPerQuoteDen),
    u64ToLe(args.genesisSupply),
    u16ToLe(args.sliceBReserveBps),
    u16ToLe(args.sliceBCreatorOfReserveBps),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: args.projectMint, isSigner: false, isWritable: true },
    { pubkey: vaultToken, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

export function buildSetAlphaVaultIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  alphaVault: PublicKey;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);

  const data = Buffer.concat([DISCRIMINATORS.set_alpha_vault, args.alphaVault.toBuffer()]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: launchState, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

export function buildAdvanceLifecycleIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  next: number;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);

  const data = Buffer.concat([
    DISCRIMINATORS.advance_lifecycle,
    Buffer.from([args.next & 0xff]),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: launchState, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

export function buildRecordGenesisParticipationIx(args: {
  user: PublicKey;
  collectionMint: PublicKey;
  assetMint: PublicKey;
  depositLamports: bigint;
  vaultTier: number;
  depositSeq: bigint;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [depositReceipt] = depositReceiptPda(launchState, args.depositSeq);
  const [mintReceipt] = mintReceiptPda(launchState, args.assetMint);

  assertU64(args.depositLamports, "depositLamports");
  assertU64(args.depositSeq, "depositSeq");

  const data = Buffer.concat([
    DISCRIMINATORS.record_genesis_participation,
    u64ToLe(args.depositLamports),
    args.assetMint.toBuffer(),
    Buffer.from([args.vaultTier & 0xff]),
    u64ToLe(args.depositSeq),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.user, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: depositReceipt, isSigner: false, isWritable: true },
    { pubkey: mintReceipt, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/**
 * Settles 3% trading tax from the launch fee buffer (L1 split: 20% platform / 80% creator leg;
 * optional holder skim from creator leg). Pass `tradeAmount` so `tax` is derived on-chain.
 * Account order must match `CollectPlatformFee`.
 */
export function buildCollectPlatformFeeIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  dammPool: PublicKey;
  /** Must equal `PlatformFeeConfig.platform_wallet`. */
  platformWallet: PublicKey;
  feeMint: PublicKey;
  feeBuffer: PublicKey;
  platformDest: PublicKey;
  holderDest: PublicKey;
  tradeAmount: bigint;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchMon] = launchMonetizationPda(args.collectionMint);
  const [holderDist] = holderRewardDistributorPda(launchState);
  const [platformCfg] = platformFeeConfigPda();
  const [launchTreasury] = launchTreasuryPda(args.collectionMint);
  const creatorVault = getAssociatedTokenAddressSync(
    args.feeMint,
    launchTreasury,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [holderRwVault] = holderRwVaultPda(args.collectionMint);

  assertU64(args.tradeAmount, "tradeAmount");

  const data = Buffer.concat([DISCRIMINATORS.collect_platform_fee, u64ToLe(args.tradeAmount)]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: METEORA_CP_AMM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: args.dammPool, isSigner: false, isWritable: false },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: launchMon, isSigner: false, isWritable: true },
    { pubkey: holderDist, isSigner: false, isWritable: true },
    { pubkey: platformCfg, isSigner: false, isWritable: false },
    { pubkey: args.feeMint, isSigner: false, isWritable: true },
    { pubkey: args.feeBuffer, isSigner: false, isWritable: true },
    { pubkey: args.platformWallet, isSigner: false, isWritable: false },
    { pubkey: args.platformDest, isSigner: false, isWritable: true },
    { pubkey: launchTreasury, isSigner: false, isWritable: false },
    { pubkey: creatorVault, isSigner: false, isWritable: true },
    { pubkey: holderRwVault, isSigner: false, isWritable: false },
    { pubkey: args.holderDest, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** Launch authority sets bps (0–10000) of trading-tax creator leg routed to holder rewards. */
export function buildSetNftHolderShareBpsIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  nftHolderShareBps: number;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchMon] = launchMonetizationPda(args.collectionMint);
  if (args.nftHolderShareBps < 0 || args.nftHolderShareBps > 10_000) {
    throw new Error("nftHolderShareBps must be 0–10000.");
  }

  const data = Buffer.concat([
    DISCRIMINATORS.set_nft_holder_share_bps,
    u16ToLe(args.nftHolderShareBps),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: launchMon, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** One-time per collection: `LaunchTreasury` + PDA-owned `creator_vault` for genesis mint-tax escrow. */
export function buildInitLaunchTreasuryIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  quoteMint: PublicKey;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchTreasury] = launchTreasuryPda(args.collectionMint);
  const creatorVault = getAssociatedTokenAddressSync(
    args.quoteMint,
    launchTreasury,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const data = DISCRIMINATORS.init_launch_treasury;

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: launchTreasury, isSigner: false, isWritable: true },
    { pubkey: args.quoteMint, isSigner: false, isWritable: false },
    { pubkey: creatorVault, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/**
 * Genesis NFT quote payment: user pays `mintPrice + 7%` on-chain; tax split is enforced in the program.
 * `baseDestination` should be the launch quote vault (same mint/owner pattern as on-chain constraints).
 */
export function buildMintNftIx(args: {
  user: PublicKey;
  collectionMint: PublicKey;
  quoteMint: PublicKey;
  userQuoteAta: PublicKey;
  baseDestinationAta: PublicKey;
  mintPrice: bigint;
  assetMint: PublicKey;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchTreasury] = launchTreasuryPda(args.collectionMint);
  const [platformCfg] = platformFeeConfigPda();
  const platformWallet = new PublicKey(CANONICAL_PLATFORM_WALLET);
  const platformQuote = getAssociatedTokenAddressSync(
    args.quoteMint,
    platformWallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const creatorVault = getAssociatedTokenAddressSync(
    args.quoteMint,
    launchTreasury,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  assertU64(args.mintPrice, "mintPrice");

  const data = Buffer.concat([
    DISCRIMINATORS.mint_nft,
    u64ToLe(args.mintPrice),
    args.assetMint.toBuffer(),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.user, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: launchTreasury, isSigner: false, isWritable: false },
    { pubkey: args.quoteMint, isSigner: false, isWritable: true },
    { pubkey: platformCfg, isSigner: false, isWritable: false },
    { pubkey: platformWallet, isSigner: false, isWritable: false },
    { pubkey: platformQuote, isSigner: false, isWritable: true },
    { pubkey: creatorVault, isSigner: false, isWritable: true },
    { pubkey: args.userQuoteAta, isSigner: false, isWritable: true },
    { pubkey: args.baseDestinationAta, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** Creator (launch authority) withdraws escrowed genesis mint-tax quote from `creator_vault`. */
export function buildClaimCreatorRewardsIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  quoteMint: PublicKey;
  destinationQuoteAta: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchTreasury] = launchTreasuryPda(args.collectionMint);
  const creatorVault = getAssociatedTokenAddressSync(
    args.quoteMint,
    launchTreasury,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  assertU64(args.amount, "amount");

  const data = Buffer.concat([DISCRIMINATORS.claim_creator_rewards, u64ToLe(args.amount)]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: false },
    { pubkey: launchTreasury, isSigner: false, isWritable: false },
    { pubkey: creatorVault, isSigner: false, isWritable: true },
    { pubkey: args.quoteMint, isSigner: false, isWritable: false },
    { pubkey: args.destinationQuoteAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** Registers `MintReceipt.allocation` into `LaunchMonetization.total_share_units` once. */
export function buildRegisterMonetizationShareIx(args: {
  payer: PublicKey;
  collectionMint: PublicKey;
  assetMint: PublicKey;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [mintReceipt] = mintReceiptPda(launchState, args.assetMint);
  const [launchMon] = launchMonetizationPda(args.collectionMint);
  const [shareReg] = shareRegistrationPda(launchState, args.assetMint);

  const data = DISCRIMINATORS.register_monetization_share;

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: false },
    { pubkey: mintReceipt, isSigner: false, isWritable: false },
    { pubkey: launchMon, isSigner: false, isWritable: true },
    { pubkey: shareReg, isSigner: false, isWritable: true },
    { pubkey: args.payer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** Funds holder vault and bumps cumulative reward-per-share index (L1 math). */
export function buildFundHolderRewardsFromVaultIx(args: {
  funder: PublicKey;
  collectionMint: PublicKey;
  rewardMint: PublicKey;
  funderToken: PublicKey;
  holderVaultToken: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchMon] = launchMonetizationPda(args.collectionMint);
  const [holderDist] = holderRewardDistributorPda(launchState);
  const [holderRwVault] = holderRwVaultPda(args.collectionMint);

  assertU64(args.amount, "amount");

  const data = Buffer.concat([DISCRIMINATORS.fund_holder_rewards_from_vault, u64ToLe(args.amount)]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.funder, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: false },
    { pubkey: launchMon, isSigner: false, isWritable: false },
    { pubkey: holderDist, isSigner: false, isWritable: true },
    { pubkey: args.rewardMint, isSigner: false, isWritable: true },
    { pubkey: args.funderToken, isSigner: false, isWritable: true },
    { pubkey: holderRwVault, isSigner: false, isWritable: false },
    { pubkey: args.holderVaultToken, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** One-time: `CreatorRewardConfig` PDA for creator-controlled holder claim pacing (see on-chain rules). */
export function buildInitializeCreatorRewardConfigIx(args: {
  creator: PublicKey;
  collectionMint: PublicKey;
  vestingDurationSlots: bigint;
  claimStartDelaySlots: bigint;
  transferCooldownSlots: bigint;
  maxClaimPerEpoch: bigint;
  creatorRewardShareBps: number;
  immutableAfterLaunch: boolean;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [cfg] = creatorRewardConfigPda(launchState);

  assertU64(args.vestingDurationSlots, "vestingDurationSlots");
  assertU64(args.claimStartDelaySlots, "claimStartDelaySlots");
  assertU64(args.transferCooldownSlots, "transferCooldownSlots");
  assertU64(args.maxClaimPerEpoch, "maxClaimPerEpoch");
  if (args.creatorRewardShareBps < 0 || args.creatorRewardShareBps > 10_000) {
    throw new Error("creatorRewardShareBps must be 0–10000.");
  }

  const data = Buffer.concat([
    DISCRIMINATORS.initialize_creator_reward_config,
    u64ToLe(args.vestingDurationSlots),
    u64ToLe(args.claimStartDelaySlots),
    u64ToLe(args.transferCooldownSlots),
    u64ToLe(args.maxClaimPerEpoch),
    u16ToLe(args.creatorRewardShareBps),
    boolIxByte(args.immutableAfterLaunch),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.creator, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: cfg, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

export function buildUpdateCreatorRewardConfigIx(args: {
  creator: PublicKey;
  collectionMint: PublicKey;
  vestingDurationSlots: bigint;
  claimStartDelaySlots: bigint;
  transferCooldownSlots: bigint;
  maxClaimPerEpoch: bigint;
  creatorRewardShareBps: number;
  immutableAfterLaunch: boolean;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [cfg] = creatorRewardConfigPda(launchState);

  assertU64(args.vestingDurationSlots, "vestingDurationSlots");
  assertU64(args.claimStartDelaySlots, "claimStartDelaySlots");
  assertU64(args.transferCooldownSlots, "transferCooldownSlots");
  assertU64(args.maxClaimPerEpoch, "maxClaimPerEpoch");
  if (args.creatorRewardShareBps < 0 || args.creatorRewardShareBps > 10_000) {
    throw new Error("creatorRewardShareBps must be 0–10000.");
  }

  const data = Buffer.concat([
    DISCRIMINATORS.update_creator_reward_config,
    u64ToLe(args.vestingDurationSlots),
    u64ToLe(args.claimStartDelaySlots),
    u64ToLe(args.transferCooldownSlots),
    u64ToLe(args.maxClaimPerEpoch),
    u16ToLe(args.creatorRewardShareBps),
    boolIxByte(args.immutableAfterLaunch),
  ]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.creator, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: true },
    { pubkey: cfg, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** Creator-funded holder incentives (requires `creator_reward_share_bps > 0` on config). */
export function buildFundCreatorNftIncentivesIx(args: {
  authority: PublicKey;
  collectionMint: PublicKey;
  rewardMint: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [cfg] = creatorRewardConfigPda(launchState);
  const [launchMon] = launchMonetizationPda(args.collectionMint);
  const [holderDist] = holderRewardDistributorPda(launchState);
  const [creatorTreasury] = creatorTreasuryPda(args.collectionMint);
  const creatorTreasuryToken = getAssociatedTokenAddressSync(
    args.rewardMint,
    creatorTreasury,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [holderRwVault] = holderRwVaultPda(args.collectionMint);
  const holderVaultToken = getAssociatedTokenAddressSync(
    args.rewardMint,
    holderRwVault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  assertU64(args.amount, "amount");

  const data = Buffer.concat([DISCRIMINATORS.fund_creator_nft_incentives, u64ToLe(args.amount)]);

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.authority, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: false },
    { pubkey: cfg, isSigner: false, isWritable: false },
    { pubkey: launchMon, isSigner: false, isWritable: false },
    { pubkey: holderDist, isSigner: false, isWritable: true },
    { pubkey: args.rewardMint, isSigner: false, isWritable: true },
    { pubkey: creatorTreasury, isSigner: false, isWritable: false },
    { pubkey: creatorTreasuryToken, isSigner: false, isWritable: true },
    { pubkey: holderRwVault, isSigner: false, isWritable: false },
    { pubkey: holderVaultToken, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

/** Claims holder rewards using cumulative index + vault balance (L1 settlement). */
export function buildClaimHolderRewardsIx(args: {
  beneficiary: PublicKey;
  collectionMint: PublicKey;
  assetMint: PublicKey;
  rewardMint: PublicKey;
  genesisPassToken: PublicKey;
  holderVaultToken: PublicKey;
  beneficiaryRewardAta: PublicKey;
  /** If set, passed as `remaining_accounts[0]` for on-chain pacing (`CreatorRewardConfig`). */
  creatorRewardConfig?: PublicKey;
}): TransactionInstruction {
  const programId = launchControllerProgramId();
  const [launchState] = launchStatePda(args.collectionMint);
  const [launchMon] = launchMonetizationPda(args.collectionMint);
  const [holderDist] = holderRewardDistributorPda(launchState);
  const [mintReceipt] = mintReceiptPda(launchState, args.assetMint);
  const [claimPos] = claimPositionPda(launchState, args.assetMint);
  const [holderRwVault] = holderRwVaultPda(args.collectionMint);

  const data = DISCRIMINATORS.claim_holder_rewards;

  const keys: TransactionInstructionCtorFields["keys"] = [
    { pubkey: args.beneficiary, isSigner: true, isWritable: true },
    { pubkey: args.collectionMint, isSigner: false, isWritable: false },
    { pubkey: launchState, isSigner: false, isWritable: false },
    { pubkey: launchMon, isSigner: false, isWritable: false },
    { pubkey: holderDist, isSigner: false, isWritable: true },
    { pubkey: mintReceipt, isSigner: false, isWritable: false },
    { pubkey: claimPos, isSigner: false, isWritable: true },
    { pubkey: args.genesisPassToken, isSigner: false, isWritable: false },
    { pubkey: holderRwVault, isSigner: false, isWritable: false },
    { pubkey: args.holderVaultToken, isSigner: false, isWritable: true },
    { pubkey: args.rewardMint, isSigner: false, isWritable: true },
    { pubkey: args.beneficiaryRewardAta, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (args.creatorRewardConfig) {
    keys.push({ pubkey: args.creatorRewardConfig, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({ programId, keys, data });
}

