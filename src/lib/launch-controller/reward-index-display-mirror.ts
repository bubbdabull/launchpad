/**
 * Display-only mirror of the on-chain reward index floor math (`monetization::claimable_rewards_floor`).
 * UI may show this as an **estimate from mirrored RPC fields** — L1 remains the only settlement authority.
 */

export const REWARD_INDEX_PRECISION_DISPLAY = 1_000_000_000_000n;

/** Floor of owed reward units from index delta × shares (matches L1 rounding). */
export function rewardOwedFloorFromIndexDisplayMirror(input: {
  shareUnits: bigint;
  cumulativeRewardPerShare: bigint;
  rewardCursor: bigint;
}): bigint {
  const { shareUnits, cumulativeRewardPerShare, rewardCursor } = input;
  if (rewardCursor > cumulativeRewardPerShare) {
    throw new Error("Invalid mirror: cursor ahead of cumulative index");
  }
  const delta = cumulativeRewardPerShare - rewardCursor;
  return (shareUnits * delta) / REWARD_INDEX_PRECISION_DISPLAY;
}
