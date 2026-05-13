import type { Collection } from "@/types/collection";
import type { TraitCollectionConfig } from "@/lib/nft-generation/types";
import {
  computeAssignmentForAsset,
  loadTraitConfigFromUrl,
} from "@/lib/nft-generation/config-loader";
import { assignmentToMetaplexAttributes } from "@/lib/nft-generation/metadata/metaplex-traits";
import { genesisRevealPhase } from "@/lib/nft-generation/reveal/gate";

const traitConfigCache = new Map<string, { at: number; config: TraitCollectionConfig }>();
const CACHE_MS = 120_000;

async function resolveTraitConfig(collection: Collection): Promise<TraitCollectionConfig | null> {
  const g = collection.genesisPassNft;
  if (!g) return null;
  if (g.traitConfig && g.traitConfig.schemaVersion === 1) return g.traitConfig;
  const uri = g.traitConfigUri?.trim();
  if (!uri) return null;
  const hit = traitConfigCache.get(uri);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.config;
  const cfg = await loadTraitConfigFromUrl(uri);
  traitConfigCache.set(uri, { at: Date.now(), config: cfg });
  return cfg;
}

function absoluteUrl(path: string, origin: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = origin.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * When `collection.genesisPassNft` is configured, merge generative traits + preview `image`
 * into the Metaplex JSON returned by `/api/metadata/asset/[address]`.
 *
 * **Cosmetic only** — does not alter on-chain MintReceipt / claim state.
 */
export async function mergeGenerativeGenesisIntoAssetMetadata(input: {
  base: Record<string, unknown>;
  collection: Collection;
  origin: string;
  assetAddress: string;
  chainAttributes: Array<{ trait_type?: string; value?: string }>;
}): Promise<Record<string, unknown>> {
  const { base, collection: c, origin, assetAddress, chainAttributes } = input;
  const g = c.genesisPassNft;
  if (!g) return base;

  const traitCfg = await resolveTraitConfig(c);
  if (!traitCfg) return base;

  const collectionMint = c.coreCollection?.trim();
  if (!collectionMint) return base;

  const now = Date.now();
  const phase = genesisRevealPhase(now, g);
  const previewImage = `${origin.replace(/\/$/, "")}/api/genesis-pass/preview/${encodeURIComponent(assetAddress)}`;

  const receiptAttrs = chainAttributes
    .filter(
      (a): a is { trait_type: string; value: string } =>
        Boolean(a.trait_type?.trim()) && a.value != null && String(a.value).trim() !== "",
    )
    .map((a) => ({ trait_type: a.trait_type!.trim(), value: String(a.value).trim() }));

  if (phase === "unrevealed") {
    const placeholder = g.placeholderImageUrl?.trim()
      ? absoluteUrl(g.placeholderImageUrl, origin)
      : typeof base.image === "string"
        ? base.image
        : absoluteUrl(c.logoUrl, origin);
    const hiddenTraits: Array<{ trait_type: string; value: string }> = [
      { trait_type: "Genesis pass", value: "Generative · unrevealed" },
      { trait_type: "Reveal", value: g.revealAt ? `Scheduled · ${g.revealAt}` : "TBD" },
    ];
    return {
      ...base,
      image: placeholder,
      animation_url: undefined,
      attributes: [...receiptAttrs, ...hiddenTraits],
    };
  }

  const assignment = computeAssignmentForAsset({
    config: traitCfg,
    launchSlug: c.slug,
    collectionMint,
    assetMint: assetAddress,
  });

  const genAttrs = assignmentToMetaplexAttributes(assignment);
  const attrs = [...receiptAttrs, ...genAttrs];

  return {
    ...base,
    image: previewImage,
    attributes: attrs,
  };
}
