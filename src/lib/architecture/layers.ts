/**
 * Central registry for the 3-layer product architecture.
 *
 * Enforcement rules (imports, markers, L2 substrings, AST toggles): `enforcement-policy.ts`.
 * Orchestration (CI + runtime invariants): `enforcement-engine.ts`.
 *
 * - **L1** = on-chain protocol (Anchor + Meteora + Core). Not represented in Next API routes.
 * - **L2** = indexer / analytics / mirrors (read-mostly; may write cache rows).
 * - **L3** = UX + auth + unsigned tx helpers + commerce coordination.
 *
 * API routes must declare `* @apiRouteLayer L2|L3|FORBIDDEN` in a file comment (see `validate-protocol.ts`).
 */

export type { ApiRouteLayer } from "./enforcement-policy";
export {
  API_ROUTE_LAYER_VALUES,
  FORBIDDEN_OPERATION_MARKERS,
  L1_FORBIDDEN_IMPORTS_IN_API,
} from "./enforcement-policy";

/**
 * Path prefixes (under `src/`) that are allowed to encode **L1** program
 * interaction (PDAs, discriminators, CPI layout). Nothing under `src/app/api/`
 * should import these — enforced by `enforcement-engine` + ESLint.
 */
export const L1_ALLOWED_MODULE_PREFIXES = [
  "lib/launch-controller/",
  "anchor/",
] as const;

/** Modules that implement L2-style mirrors, rollups, or webhook ingestion. */
export const L2_ALLOWED_MODULE_PREFIXES = [
  "lib/supabase/",
  "lib/reputation/",
  "lib/ecosystem/",
  "lib/solana/helius",
  "lib/security/",
  "lib/auth/session",
  "lib/referrals/",
] as const;

/** Modules that are pure UX, auth servers, metadata helpers, uploads. */
export const L3_ALLOWED_MODULE_PREFIXES = [
  "lib/auth/",
  "lib/metadata/",
  "lib/security/",
  "lib/creators/",
  "components/",
] as const;

/** Dev-only hook: extend to log suspicious handler patterns. */
export function devWarnIfLayerViolation(_context: { route: string; hint: string }): void {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.LAYER_DEV_WARNINGS !== "1") return;
  // Intentionally quiet unless LAYER_DEV_WARNINGS=1 — opt-in noise control.
}
