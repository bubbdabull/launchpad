/**
 * Default launch-controller program id (must match `declare_id!` in
 * `anchor/programs/launch-controller/src/lib.rs` and the bytecode **actually**
 * deployed at this address). If simulation logs show `DeclaredProgramIdMismatch`
 * (4100), the on-chain program at this pubkey is wrong — run `anchor upgrade` from
 * this repo, or set `NEXT_PUBLIC_LAUNCH_CONTROLLER_PROGRAM_ID` to a pubkey where you
 * deployed a matching build.
 */
export const LAUNCH_CONTROLLER_PROGRAM_ID =
  "EfjEi5nQVmupvYHLLhexmcrM39WhdFq8Y7r4waSbyxEf" as const;

/** Immutable global platform SPL receiver — must match on-chain `CANONICAL_PLATFORM_WALLET`. */
export const CANONICAL_PLATFORM_WALLET =
  "DZM5SUFNThmzarZzKiJouwxh1XZtSstwbnN2F4vNCz3k" as const;

/** Anchor event names emitted by `launch-controller` (for log parsers). */
export const LAUNCH_CONTROLLER_EVENTS = [
  "LaunchInitialized",
  "AlphaVaultLinked",
  "LifecycleAdvanced",
  "GenesisParticipationRecorded",
  "TrancheClaimed",
  "NFTMintTaxCollected",
  "NFTMintPlatformShareTransferred",
  "NFTMintCreatorShareAllocated",
  "NFTMintExecuted",
  "TradingTaxCollected",
  "PlatformRevenueCollected",
  "CreatorRevenueAllocated",
  "HolderRewardsFunded",
  "HolderRewardsClaimed",
  "CreatorRewardConfigInitialized",
  "CreatorRewardConfigUpdated",
  "CreatorIncentiveFunded",
  "NFTClaimParametersApplied",
] as const;

export type LaunchControllerEventName = (typeof LAUNCH_CONTROLLER_EVENTS)[number];

/** Instruction discriminators are SHA256("global:<name>")[0..8]; prefer IDL in production. */
export const LAUNCH_CONTROLLER_IX_NAMES = [
  "initialize_launch",
  "set_alpha_vault",
  "advance_lifecycle",
  "record_genesis_participation",
  "claim",
] as const;
