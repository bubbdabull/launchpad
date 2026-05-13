import { createHash } from "node:crypto";

import type { TraitCollectionConfig } from "@/lib/nft-generation/types";
import { genesisDeterministicSeedBytes } from "@/lib/nft-generation/traits/rng";
import { resolveGenesisTraits } from "@/lib/nft-generation/traits/resolve";

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function assertTraitCollectionConfig(raw: unknown): TraitCollectionConfig {
  if (!isObject(raw)) throw new Error("trait-config: root must be an object");
  if (raw.schemaVersion !== 1) throw new Error("trait-config: schemaVersion must be 1");
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("trait-config: width/height must be positive numbers");
  }
  const layersRaw = raw.layers;
  if (!Array.isArray(layersRaw) || layersRaw.length === 0) throw new Error("trait-config: layers[] required");

  const layers: TraitCollectionConfig["layers"] = [];
  for (const L of layersRaw) {
    if (!isObject(L)) throw new Error("trait-config: invalid layer");
    const id = String(L.id ?? "").trim();
    const displayName = String(L.displayName ?? "").trim();
    const order = Number(L.order);
    if (!id || !displayName || !Number.isFinite(order)) throw new Error(`trait-config: bad layer header for ${id || "?"}`);
    const traitsRaw = L.traits;
    if (!Array.isArray(traitsRaw) || traitsRaw.length === 0) throw new Error(`trait-config: layer ${id} needs traits[]`);
    const traits: TraitCollectionConfig["layers"][0]["traits"] = [];
    for (const t of traitsRaw) {
      if (!isObject(t)) throw new Error(`trait-config: bad trait in ${id}`);
      const tid = String(t.id ?? "").trim();
      const name = String(t.name ?? "").trim();
      const weight = Number(t.weight);
      const file = String(t.file ?? "").trim();
      if (!tid || !name || !file || !Number.isFinite(weight) || weight < 0) {
        throw new Error(`trait-config: invalid trait in ${id}`);
      }
      const tier = t.tier === "Common" || t.tier === "Rare" || t.tier === "Epic" || t.tier === "Legendary" ? t.tier : undefined;
      traits.push({
        id: tid,
        name,
        weight,
        file,
        tier,
        animation: Boolean(t.animation),
      });
    }
    layers.push({ id, displayName, order, traits });
  }

  const incompatibilities = Array.isArray(raw.incompatibilities)
    ? (raw.incompatibilities as TraitCollectionConfig["incompatibilities"])
    : undefined;

  const overrides = isObject(raw.overrides) ? (raw.overrides as TraitCollectionConfig["overrides"]) : undefined;

  const backgroundColor =
    typeof raw.backgroundColor === "string" && raw.backgroundColor.trim() ? raw.backgroundColor.trim() : undefined;

  return {
    schemaVersion: 1,
    width,
    height,
    backgroundColor,
    layers,
    incompatibilities,
    overrides,
  };
}

export async function loadTraitConfigFromUrl(uri: string): Promise<TraitCollectionConfig> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`trait-config fetch failed: ${res.status}`);
  const json = (await res.json()) as unknown;
  return assertTraitCollectionConfig(json);
}

export function loadTraitConfigFromJsonText(text: string): TraitCollectionConfig {
  return assertTraitCollectionConfig(JSON.parse(text) as unknown);
}

/** Batch / script: per-mint index mixed into seed for unique combos. */
export function batchSeedBytes(launchSalt: string, mintIndex: number): Uint8Array {
  const h = createHash("sha256");
  h.update("creator-launchpad/genesis-pass/batch/v1\0");
  h.update(launchSalt, "utf8");
  h.update("\0", "utf8");
  h.update(String(mintIndex), "utf8");
  return new Uint8Array(h.digest());
}

export function perAssetSeedBytes(input: {
  launchSlug: string;
  collectionMint: string;
  assetMint: string;
  blockhashEntropy?: string;
}): Uint8Array {
  return genesisDeterministicSeedBytes(input);
}

export function computeAssignmentForAsset(input: {
  config: TraitCollectionConfig;
  launchSlug: string;
  collectionMint: string;
  assetMint: string;
  blockhashEntropy?: string;
}) {
  const seed = perAssetSeedBytes(input);
  return resolveGenesisTraits(input.config, seed);
}

export function computeAssignmentForBatchIndex(input: {
  config: TraitCollectionConfig;
  launchSalt: string;
  mintIndex: number;
}) {
  const seed = batchSeedBytes(input.launchSalt, input.mintIndex);
  return resolveGenesisTraits(input.config, seed);
}
