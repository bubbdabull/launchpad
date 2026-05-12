/**
 * Deterministic lifecycle spine (READ-ONLY spec).
 * Actual mutation: Anchor program only — never API routes.
 */

import type { LaunchState } from "./protocol-spec";

/** Ordered primary spine (monotonic forward index). */
export const LAUNCH_STATE_MONOTONIC_ORDER: readonly LaunchState[] = [
  "DRAFT",
  "VAULT_OPEN",
  "MINT_ACTIVE",
  "TRADING_ACTIVE",
  "CLAIM_ACTIVE",
  "FINALIZED",
] as const;

const INDEX = new Map<LaunchState, number>(LAUNCH_STATE_MONOTONIC_ORDER.map((s, i) => [s, i]));

/** Single-step edges allowed on the canonical spine (on-chain preconditions apply in program). */
export const VALID_LAUNCH_TRANSITIONS: ReadonlyArray<readonly [LaunchState, LaunchState]> = [
  ["DRAFT", "VAULT_OPEN"],
  ["VAULT_OPEN", "MINT_ACTIVE"],
  ["MINT_ACTIVE", "TRADING_ACTIVE"],
  ["TRADING_ACTIVE", "CLAIM_ACTIVE"],
  ["CLAIM_ACTIVE", "FINALIZED"],
] as const;

const EDGE_KEY = new Set(VALID_LAUNCH_TRANSITIONS.map(([a, b]) => `${a}->${b}`));

/**
 * Whether `to` is exactly one step forward on the spine from `from`
 * (program may still require CPI proofs — this is the structural graph only).
 */
export function isValidLaunchTransition(from: LaunchState, to: LaunchState): boolean {
  return EDGE_KEY.has(`${from}->${to}`);
}

/** True if `b` is strictly after `a` on the spine (same position = false). */
export function isStrictlyAfterOnSpine(a: LaunchState, b: LaunchState): boolean {
  const ia = INDEX.get(a);
  const ib = INDEX.get(b);
  if (ia === undefined || ib === undefined) return false;
  return ib > ia;
}
