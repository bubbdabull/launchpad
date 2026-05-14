/**
 * Slice B = share of the fixed 1B SPL reserved for creator + Genesis holders (rest is liquidity / program path).
 * `MAX_SLICE_B_RESERVE_PCT` / `MAX_SLICE_B_RESERVE_BPS` must stay aligned with `MAX_SLICE_B_RESERVE_BPS` in
 * `anchor/programs/launch-controller/src/lib.rs`.
 *
 * **Target launch routing:** **Slice A** → Meteora **Alpha Vault / DAMM** primary liquidity; **Slice B** → two
 * **PDA vaults** on the project mint (creator share + Genesis NFT holder share), not the creator’s personal wallet.
 * Full supply should sit under program custody until claims; see Anchor `lib.rs` routing comment + this header for
 * the current TS gap (mint still lands on payer before pool).
 */
export const MAX_SLICE_B_RESERVE_PCT = 30;
export const MAX_SLICE_B_RESERVE_BPS = MAX_SLICE_B_RESERVE_PCT * 100;

export function clampSliceBPct(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(MAX_SLICE_B_RESERVE_PCT, Math.round(n)));
}
