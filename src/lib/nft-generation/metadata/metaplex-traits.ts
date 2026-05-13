import type { GenesisTraitAssignment } from "@/lib/nft-generation/types";

/** Metaplex / Tensor / Magic Eden compatible `attributes` entries. */
export function assignmentToMetaplexAttributes(a: GenesisTraitAssignment): Array<{ trait_type: string; value: string }> {
  const attrs: Array<{ trait_type: string; value: string }> = [
    { trait_type: "Rarity summary", value: a.summaryTier },
    { trait_type: "Combo id", value: a.comboId },
  ];
  for (const p of a.picks) {
    attrs.push({ trait_type: p.layerDisplayName, value: p.traitName });
    if (p.tier) attrs.push({ trait_type: `${p.layerDisplayName} tier`, value: p.tier });
  }
  return attrs;
}
