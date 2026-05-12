/** Default program id from Anchor template — replace after deploy. */
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
