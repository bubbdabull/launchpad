import type { GenesisTraitAssignment, TraitCollectionConfig } from "@/lib/nft-generation/types";

/**
 * Deterministic numeric score from resolved picks vs layer weight totals.
 * Higher ≈ rarer under a naive independence model (ignores incompat re-filtering).
 * Used only for ordering a leaderboard — not on-chain truth.
 */
export function naiveRarityScoreFromAssignment(
  config: TraitCollectionConfig,
  assignment: GenesisTraitAssignment,
): number {
  const layers = [...config.layers].sort((a, b) => a.order - b.order);
  let sum = 0;
  for (const pick of assignment.picks) {
    const layer = layers.find((l) => l.id === pick.layerId);
    if (!layer) continue;
    const t = layer.traits.find((x) => x.id === pick.traitId);
    if (!t) continue;
    const totalW = layer.traits.reduce((s, x) => s + Math.max(0, x.weight), 0);
    if (totalW <= 0 || t.weight <= 0) continue;
    const p = t.weight / totalW;
    sum += -Math.log(Math.max(p, 1e-15));
  }
  return Math.round(sum * 1_000_000);
}
