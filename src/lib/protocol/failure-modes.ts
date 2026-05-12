/**
 * Formal prohibited system states (READ-ONLY spec hooks for enforcement).
 * Severity is always CRITICAL for listed modes.
 */

export type ProtocolFailureModeId =
  | "ShadowAllocationDetected"
  | "IndexerBecomesAuthoritative"
  | "DualSourceOfTruth"
  | "BackendPayoutLogicDetected"
  | "OffChainEntitlementDetected"
  | "L2FeeAuthorityDetected";

export type ProtocolFailureScope = "L2_ROUTE" | "L3_ROUTE" | "LIB_TS";

export type ProtocolFailureModeDefinition = {
  id: ProtocolFailureModeId;
  description: string;
  severity: "CRITICAL";
  /** Matched on source after block comments stripped (deterministic list order). */
  detectionSubstrings: readonly string[];
  /** AST hook name reserved for future wiring — substring scan runs in engine today. */
  astHook: "l2-ast-scanner" | "none";
  scope: readonly ProtocolFailureScope[];
};

export const PROTOCOL_FAILURE_MODES: readonly ProtocolFailureModeDefinition[] = [
  {
    id: "ShadowAllocationDetected",
    description: "Off-chain code attempts to define or settle allocation / payout authority.",
    severity: "CRITICAL",
    detectionSubstrings: ["offChainAllocation", "shadowPayout", "holderPayouts:", "allocateHolderShares"],
    astHook: "l2-ast-scanner",
    scope: ["L2_ROUTE", "L3_ROUTE", "LIB_TS"],
  },
  {
    id: "IndexerBecomesAuthoritative",
    description: "L2/indexer path treats analytics or DB as entitlement or allocation authority.",
    severity: "CRITICAL",
    detectionSubstrings: ["authorityFromAnalytics", "effectiveOwnership", "deriveOwnership"],
    astHook: "l2-ast-scanner",
    scope: ["L2_ROUTE", "L3_ROUTE", "LIB_TS"],
  },
  {
    id: "DualSourceOfTruth",
    description: "Financial state would diverge between Supabase and chain as competing authorities.",
    severity: "CRITICAL",
    detectionSubstrings: ["dbOverridesChain", "preferDbOverRpc", "ignoreChainIfDb"],
    astHook: "none",
    scope: ["L2_ROUTE", "L3_ROUTE", "LIB_TS"],
  },
  {
    id: "BackendPayoutLogicDetected",
    description: "Server-side distribution / payout planning beyond read-only mirroring.",
    severity: "CRITICAL",
    detectionSubstrings: [
      "planClaimAndDistribute",
      "buildHolderPayoutTx",
      "planTokenDistribution",
      "buildTokenPayoutTx",
      "simulatePayout",
    ],
    astHook: "none",
    scope: ["L2_ROUTE", "L3_ROUTE", "LIB_TS"],
  },
  {
    id: "OffChainEntitlementDetected",
    description: "API or lib reconstructs reward entitlement / authoritative claimable outside L1.",
    severity: "CRITICAL",
    detectionSubstrings: [
      "calculateClaimable",
      "estimatedEntitlement",
      "authoritativeClaimable",
      "persistEntitlement",
      "dbClaimable",
      "canonicalClaimable",
      "computeRewardSplit",
    ],
    astHook: "l2-ast-scanner",
    scope: ["L2_ROUTE", "L3_ROUTE", "LIB_TS"],
  },
  {
    id: "L2FeeAuthorityDetected",
    description: "Off-chain fee split or per-holder reward plan that would compete with on-chain config.",
    severity: "CRITICAL",
    detectionSubstrings: ["rewardsPerHolder", "payoutSplit", "feeDistributionPlan", "rewardSplitPlanner"],
    astHook: "l2-ast-scanner",
    scope: ["L2_ROUTE", "L3_ROUTE", "LIB_TS"],
  },
] as const;

const failureModes = {
  version: "1.0.0" as const,
  modes: PROTOCOL_FAILURE_MODES,
};

export default failureModes;
