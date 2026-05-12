/**
 * Relaxed gate: mint lane can open once vault + Core + project SPL exist, even if Anchor
 * `LaunchState` is still before `LC_MINT_ACTIVE`. Hybrid txs then omit
 * `record_genesis_participation` until lifecycle catches up.
 *
 * - `NEXT_PUBLIC_RELAX_GENESIS_MINT_LIFECYCLE=true` (or `1` / `yes`): relaxed on any environment.
 * - `false` / `0` / `no`: strict Anchor `MINT_ACTIVE` requirement (even in `next dev`).
 * - **Unset**: strict in production builds; **relaxed in `next dev`** so local mint works without
 *   finishing Anchor every time.
 */
export function relaxedGenesisMintWithoutLifecycle(): boolean {
  const v = process.env.NEXT_PUBLIC_RELAX_GENESIS_MINT_LIFECYCLE?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return process.env.NODE_ENV === "development";
}
