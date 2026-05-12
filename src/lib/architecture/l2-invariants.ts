/**
 * L2 IS NOT ALLOWED TO RECONSTRUCT FINANCIAL STATE IN ANY FORM:
 * - explicit
 * - implicit
 * - derived
 * - reconstructed
 * - string-composed
 * - or inferred
 *
 * Only raw read-only chain data allowed.
 *
 * L2 (analytics / indexer mirror) semantic contract — delegates to
 * `enforcement-engine.ts` (rules: `enforcement-policy.ts`). Full CI gate:
 * `src/lib/protocol/validate-protocol.ts`.
 */

export {
  assertL2DynamicSnippetInvariant as assertL2Invariant,
  enforceL2RouteModuleBoundary,
  scanL2SourceForForbiddenSubstrings as scanL2SourceForForbiddenPatterns,
} from "./enforcement-engine";

/** Human-readable contract (docs + tooling). */
export const L2_FORBIDDEN_BEHAVIOR = [
  "computing allocations as authority",
  "simulating claim results beyond RPC read + transparent display",
  "estimating vesting rewards as authoritative on-chain substitutes",
  "deriving effective ownership not present on-chain",
  "converting analytics into payout or eligibility logic",
] as const;

export const L2_ALLOWED_BEHAVIOR = [
  "aggregation of mirrored / on-chain-backed data",
  "sorting, ranking, filtering for UX",
  "caching RPC or indexer results",
  "displaying derived, clearly non-authoritative metrics",
  "historical indexing and audit rows",
] as const;
