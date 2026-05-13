/** Rarity tier labels for marketplace `attributes` (cosmetic only). */
export type RarityTierName = "Common" | "Rare" | "Epic" | "Legendary";

export type TraitLayerDefinition = {
  /** Stable id, e.g. `background` */
  id: string;
  /** Display name, e.g. `Background` */
  displayName: string;
  /** Lower renders first (background). */
  order: number;
  traits: TraitOptionDefinition[];
};

export type TraitOptionDefinition = {
  id: string;
  /** Human-readable name for metadata + marketplaces */
  name: string;
  /** Relative weight within this layer after filtering incompatibilities. */
  weight: number;
  /** Local path (generation script) or https URL (runtime composite / CDN). */
  file: string;
  /** Optional tier for summary + UI framing. */
  tier?: RarityTierName;
  /** Hint for UI — does not change on-chain claim logic. */
  animation?: boolean;
};

export type TraitIncompatibilityRule = {
  when: Array<{ layerId: string; traitId: string }>;
  forbid: Array<{ layerId: string; traitId: string }>;
};

/**
 * Full collection trait configuration (validated at load / script time).
 * File convention: `trait-config.json` alongside creator layer assets.
 */
export type TraitCollectionConfig = {
  schemaVersion: 1;
  /** Canvas size for compositing */
  width: number;
  height: number;
  /** Optional default background hex if a trait has transparency */
  backgroundColor?: string;
  layers: TraitLayerDefinition[];
  incompatibilities?: TraitIncompatibilityRule[];
  /** Optional creator overrides keyed by `layerId:traitId` merged after roll */
  overrides?: Record<string, { traitId?: string }>;
};

export type ResolvedTraitPick = {
  layerId: string;
  layerDisplayName: string;
  traitId: string;
  traitName: string;
  file: string;
  tier?: RarityTierName;
  animation?: boolean;
};

export type GenesisTraitAssignment = {
  /** Stable fingerprint of the resolved combo (duplicate detection). */
  comboId: string;
  picks: ResolvedTraitPick[];
  /** Highest tier among picks that declare a tier */
  summaryTier: RarityTierName;
};

export type TraitManifestEntry = {
  mintIndex: number;
  comboId: string;
  picks: ResolvedTraitPick[];
  summaryTier: RarityTierName;
};
