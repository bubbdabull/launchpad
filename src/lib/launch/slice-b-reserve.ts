/**
 * Slice B = share of the fixed 1B SPL reserved for creator + Genesis holders (rest is liquidity / program path).
 * `MAX_SLICE_B_RESERVE_PCT` / `MAX_SLICE_B_RESERVE_BPS` must stay aligned with `MAX_SLICE_B_RESERVE_BPS` in
 * `anchor/programs/launch-controller/src/lib.rs`.
 */
export const MAX_SLICE_B_RESERVE_PCT = 30;
export const MAX_SLICE_B_RESERVE_BPS = MAX_SLICE_B_RESERVE_PCT * 100;

export function clampSliceBPct(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(MAX_SLICE_B_RESERVE_PCT, Math.round(n)));
}
