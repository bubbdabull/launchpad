/**
 * Single source of truth for API / L2 architecture enforcement.
 *
 * ENFORCEMENT MUST BE DETERMINISTIC: same source bytes and same options → same
 * violation list (stable ordering of rules in `enforcement-engine.ts`).
 *
 * Do not duplicate these lists in scripts, ESLint, or route files — extend here
 * only. `scripts/verify-enforcement-island.ts` fails CI if bans drift from ESLint.
 */

/** Next.js App Router API surface — never L1. */
export type ApiRouteLayer = "L2" | "L3" | "FORBIDDEN";

export const API_ROUTE_LAYER_VALUES: readonly ApiRouteLayer[] = ["L2", "L3", "FORBIDDEN"] as const;

/**
 * L2 substring rules (comments stripped by the engine before matching).
 * Kept tight to avoid false positives (e.g. JWT “claims” vs claimable).
 */
export const L2_FORBIDDEN_SUBSTRINGS: readonly string[] = [
  "claimable =",
  "claimable=",
  "allocation =",
  "allocation=",
  "payout =",
  "payout=",
  "vestedAmount calculated",
  "ownership derived from offchain math",
  "effectiveOwnership",
  "deriveOwnership",
  "computeClaim",
  "planPayout",
  "simulateClaim",
  "shadowPayout",
  "offChainAllocation",
  "authorityFromAnalytics",
  "rewardsPerHolder",
  "payoutSplit",
  "feeDistributionPlan",
  "calculateClaimable",
  "estimatedEntitlement",
  "authoritativeClaimable",
  "persistEntitlement",
  "dbClaimable",
  "computeRewardSplit",
  "canonicalClaimable",
  "holderEntitlement",
  "rewardSplitPlanner",
] as const;

/**
 * Import specifiers that API routes (L2/L3/FORBIDDEN) must never load.
 * ESLint `no-restricted-imports` must stay in lockstep (see verify-enforcement-island).
 */
export const L1_FORBIDDEN_IMPORTS_IN_API: readonly string[] = [
  "@/lib/launch-controller",
  "@/lib/launch/reward-token-distribute",
] as const;

/** Removed payout / planner identifiers (comments stripped before scan). */
export const FORBIDDEN_OPERATION_MARKERS: readonly string[] = [
  "planClaimAndDistribute",
  "buildHolderPayoutTx",
  "planTokenDistribution",
  "buildTokenPayoutTx",
  "holderPayouts:",
  "allocateHolderShares",
  "computeVestingSchedule",
  "simulatePayout",
  "computeHolderRewards",
  "buildRewardClaimPayload",
  "syncClaimableToDb",
] as const;

/** Object / type literal keys that imply reconstructed financial authority (AST). */
export const L2_AST_FORBIDDEN_OBJECT_KEYS: readonly string[] = [
  "payout",
  "allocation",
  "claimable",
  "vestedAmount",
] as const;

/** AST analyzer toggles — all default on; disable only for targeted debugging. */
export const L2_AST_ANALYSIS_POLICY = {
  identifierFinancialNames: true,
  forbiddenObjectKeys: true,
  stringCompositionAgainstL2Substrings: true,
  templateShellAgainstL2Substrings: true,
  dynamicJsonParse: true,
  evalCall: true,
  functionNameAndSignatureTypes: true,
} as const;

/**
 * Module-load L2 checks default to substring-only so production API bundles are not
 * required to load the TypeScript compiler. Set `L2_FULL_ENFORCE_AT_RUNTIME=1` to
 * run AST at runtime (matches CI when `typescript` is resolvable).
 */
export function l2FileEnforcementAtModuleLoad(): { includeAst: boolean } {
  return { includeAst: process.env.L2_FULL_ENFORCE_AT_RUNTIME === "1" };
}

/** Preferred for App Router: Next.js 16+ rejects extra `export const` on routes. */
export const API_ROUTE_LAYER_TAG_RE = /@apiRouteLayer\s+(L2|L3|FORBIDDEN)\b/;

/** Legacy: `export const LAYER = "L2" | ...` (kept for backwards compatibility). */
export const API_ROUTE_LAYER_EXPORT_RE =
  /export\s+const\s+LAYER\s*(?::\s*ApiRouteLayer\s*)?\s*=\s*["'](L2|L3|FORBIDDEN)["'](?:\s+as\s+const)?\s*;/;

export const API_ROUTE_LAYER_SATISFIES_RE =
  /export\s+const\s+LAYER\s*=\s*["'](L2|L3|FORBIDDEN)["']\s+satisfies\s+ApiRouteLayer\s*;/;

export const API_ROUTE_ARCHITECTURE_IMPORT_RE =
  /from\s+["']@\/lib\/architecture\/layers["']/;
