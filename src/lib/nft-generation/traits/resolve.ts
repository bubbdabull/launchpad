import type {
  GenesisTraitAssignment,
  ResolvedTraitPick,
  RarityTierName,
  TraitCollectionConfig,
  TraitLayerDefinition,
  TraitOptionDefinition,
} from "@/lib/nft-generation/types";
import { rngFromSeed32 } from "@/lib/nft-generation/traits/rng";
import { pickWeightedIndex } from "@/lib/nft-generation/traits/weights";
import { createHash } from "node:crypto";

const TIER_RANK: Record<RarityTierName, number> = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
};

function maxTier(a: RarityTierName, b: RarityTierName): RarityTierName {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

function traitKey(layerId: string, traitId: string): string {
  return `${layerId}:${traitId}`;
}

function violatesIncompatibilities(
  picked: Map<string, string>,
  rules: TraitCollectionConfig["incompatibilities"],
): boolean {
  if (!rules?.length) return false;
  for (const rule of rules) {
    const whenOk = rule.when.every((w) => picked.get(w.layerId) === w.traitId);
    if (!whenOk) continue;
    for (const f of rule.forbid) {
      if (picked.get(f.layerId) === f.traitId) return true;
    }
  }
  return false;
}

function applyOverrides(
  layers: TraitLayerDefinition[],
  picks: Map<string, TraitOptionDefinition>,
  overrides: TraitCollectionConfig["overrides"],
): void {
  if (!overrides) return;
  for (const layer of layers) {
    const o = overrides[layer.id];
    if (!o?.traitId) continue;
    const hit = layer.traits.find((t) => t.id === o.traitId);
    if (hit) picks.set(layer.id, hit);
  }
}

function comboHash(picks: Map<string, TraitOptionDefinition>, layerOrder: TraitLayerDefinition[]): string {
  const h = createHash("sha256");
  for (const layer of layerOrder) {
    const t = picks.get(layer.id);
    if (!t) continue;
    h.update(layer.id, "utf8");
    h.update("=", "utf8");
    h.update(t.id, "utf8");
    h.update("|", "utf8");
  }
  return h.digest("hex").slice(0, 32);
}

/**
 * Deterministic generative assignment from a 32-byte seed.
 * Uses independent RNG streams per layer index for stable ordering.
 */
export function resolveGenesisTraits(
  config: TraitCollectionConfig,
  seed32: Uint8Array,
  opts?: { maxAttempts?: number },
): GenesisTraitAssignment {
  const maxAttempts = opts?.maxAttempts ?? 64;
  const layers = [...config.layers].sort((a, b) => a.order - b.order);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = new Uint8Array(seed32);
    if (attempt > 0) {
      const h = createHash("sha256");
      h.update(seed32);
      h.update(`attempt:${attempt}`);
      attemptSeed.set(h.digest());
    }

    const picked = new Map<string, TraitOptionDefinition>();
    let stream = 0;

    for (const layer of layers) {
      const rnd = rngFromSeed32(attemptSeed, stream++);
      const candidates: TraitOptionDefinition[] = [];
      const weights: number[] = [];

      for (const trait of layer.traits) {
        const trialIds = new Map<string, string>();
        for (const [k, v] of picked) trialIds.set(k, v.id);
        trialIds.set(layer.id, trait.id);
        if (violatesIncompatibilities(trialIds, config.incompatibilities)) continue;
        candidates.push(trait);
        weights.push(trait.weight);
      }

      if (candidates.length === 0) {
        picked.clear();
        break;
      }

      const idx = pickWeightedIndex(weights, rnd);
      const chosen = candidates[idx] ?? candidates[0];
      picked.set(layer.id, chosen);
    }

    if (picked.size !== layers.length) continue;

    applyOverrides(layers, picked, config.overrides);

    const pickedMap: Map<string, string> = new Map();
    for (const [k, v] of picked) pickedMap.set(k, v.id);
    if (violatesIncompatibilities(pickedMap, config.incompatibilities)) continue;

    const resolved: ResolvedTraitPick[] = layers.map((layer) => {
      const t = picked.get(layer.id)!;
      return {
        layerId: layer.id,
        layerDisplayName: layer.displayName,
        traitId: t.id,
        traitName: t.name,
        file: t.file,
        tier: t.tier,
        animation: t.animation,
      };
    });

    let summaryTier: RarityTierName = "Common";
    for (const p of resolved) {
      if (p.tier) summaryTier = maxTier(summaryTier, p.tier);
    }

    return {
      comboId: comboHash(picked, layers),
      picks: resolved,
      summaryTier,
    };
  }

  throw new Error("resolveGenesisTraits: could not satisfy constraints — widen weights or relax incompatibilities.");
}
