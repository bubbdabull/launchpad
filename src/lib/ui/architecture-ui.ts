/**
 * UI ↔ architecture contract (read this before shipping money-adjacent UI).
 *
 * The frontend MUST remain non-authoritative:
 * - Never compute claim eligibility, allocations, vesting settlement, or payouts as law.
 * - Display RPC / indexer / mirrored fields only; label estimates clearly.
 * - Build unsigned transactions from IDL / known layouts; program decides acceptance.
 *
 * L1 = truth · L2 = observation · L3 = interaction · L4 = protocol spec (CI only).
 */

export const UI_NON_AUTHORITY_DISCLAIMER =
  "Display only — on-chain program is the source of truth for money and lifecycle.";
