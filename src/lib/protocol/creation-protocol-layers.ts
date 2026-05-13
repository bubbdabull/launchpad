/**
 * Immutable snapshot stored on `collections.creation_protocol_layers` at draft insert.
 * v1: platform L1/L2/L3 only. v2: adds `nftCollectionLayers` (Genesis Pass / variations / holder UX).
 * Authoritative mint + ownership rules remain L1 on-chain — this JSON is disclosure + audit only.
 */

export type CreationProtocolLayerId = "L1" | "L2" | "L3";

export type CreationProtocolLayer = {
  id: CreationProtocolLayerId;
  title: string;
  subtitle: string;
  responsibilities: string[];
  boundaries: string[];
};

export type CreationProtocolLayersSnapshot = {
  schemaVersion: "creation-protocol-layers/1" | "creation-program/2";
  /** ISO-8601 when the row was created (server clock). */
  capturedAt: string;
  documentationRef: string;
  /** Platform stack: chain vs mirrors vs this app (`docs/PRODUCT_ARCHITECTURE.md`). */
  layers: CreationProtocolLayer[];
  /**
   * v2 only: Genesis Pass / NFT collection — where trait variation is configured in this app vs
   * what lives on-chain or in indexers. Omitted in v1 snapshots.
   */
  nftCollectionLayers?: CreationProtocolLayer[];
};

/** Canonical platform L1/L2/L3 (stored JSON + tiny UI tiles). */
export const CREATION_PROTOCOL_LAYERS: readonly CreationProtocolLayer[] = [
  {
    id: "L1",
    title: "On-chain",
    subtitle: "Mints, pools, and balances — the programs on Solana.",
    responsibilities: ["Holds the real money and rules."],
    boundaries: ["The website cannot change those rules."],
  },
  {
    id: "L2",
    title: "Synced data",
    subtitle: "Numbers and lists you see in the app.",
    responsibilities: ["Faster reads and history for the UI."],
    boundaries: ["Does not replace what the chain says."],
  },
  {
    id: "L3",
    title: "This site",
    subtitle: "Forms, images, and preparing transactions for you to sign.",
    responsibilities: ["Walks you through setup and mint."],
    boundaries: ["Your wallet still approves every important step."],
  },
] as const;

/** Genesis / NFT slice (audit JSON only — not shown as a wall of copy in the UI). */
export const NFT_COLLECTION_PROGRAM_LAYERS: readonly CreationProtocolLayer[] = [
  {
    id: "L1",
    title: "NFTs on-chain",
    subtitle: "What gets minted and who owns it.",
    responsibilities: ["Ownership and metadata the chain records."],
    boundaries: ["Art links update when you sign the right transactions."],
  },
  {
    id: "L2",
    title: "Synced NFT data",
    subtitle: "Holders, volume, and saved art links.",
    responsibilities: ["Powers dashboards and mint pages."],
    boundaries: ["Does not change who owns what."],
  },
  {
    id: "L3",
    title: "Setup here",
    subtitle: "Art, traits, reveal timing, and rarity links.",
    responsibilities: ["What you configure before and after launch."],
    boundaries: ["Still need your wallet to deploy and update on-chain."],
  },
] as const;

function cloneLayers(src: readonly CreationProtocolLayer[]): CreationProtocolLayer[] {
  return src.map((L) => ({
    id: L.id,
    title: L.title,
    subtitle: L.subtitle,
    responsibilities: [...L.responsibilities],
    boundaries: [...L.boundaries],
  }));
}

function parseLayerArray(raw: unknown): CreationProtocolLayer[] | null {
  if (!Array.isArray(raw)) return null;
  const layers: CreationProtocolLayer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const L = item as Record<string, unknown>;
    const id = L.id;
    if (id !== "L1" && id !== "L2" && id !== "L3") continue;
    const title = typeof L.title === "string" ? L.title.trim() : "";
    const subtitle = typeof L.subtitle === "string" ? L.subtitle.trim() : "";
    if (!title) continue;
    const responsibilities = Array.isArray(L.responsibilities)
      ? L.responsibilities
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
      : [];
    const boundaries = Array.isArray(L.boundaries)
      ? L.boundaries
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
      : [];
    layers.push({ id, title, subtitle: subtitle || "", responsibilities, boundaries });
  }
  return layers.length === 3 ? layers : null;
}

export function buildCreationProtocolLayersSnapshot(): CreationProtocolLayersSnapshot {
  return {
    schemaVersion: "creation-program/2",
    capturedAt: new Date().toISOString(),
    documentationRef: "docs/PRODUCT_ARCHITECTURE.md",
    layers: cloneLayers(CREATION_PROTOCOL_LAYERS),
    nftCollectionLayers: cloneLayers(NFT_COLLECTION_PROGRAM_LAYERS),
  };
}

export function parseCreationProtocolLayersSnapshot(raw: unknown): CreationProtocolLayersSnapshot | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ver = o.schemaVersion;
  if (ver !== "creation-protocol-layers/1" && ver !== "creation-program/2") return null;
  if (typeof o.capturedAt !== "string" || !o.capturedAt.trim()) return null;
  const documentationRef =
    typeof o.documentationRef === "string" && o.documentationRef.trim()
      ? o.documentationRef.trim()
      : "docs/PRODUCT_ARCHITECTURE.md";
  const layers = parseLayerArray(o.layers);
  if (!layers) return null;

  let nftCollectionLayers: CreationProtocolLayer[] | undefined;
  if (ver === "creation-program/2") {
    const parsedNft = parseLayerArray(o.nftCollectionLayers);
    nftCollectionLayers = parsedNft ?? cloneLayers(NFT_COLLECTION_PROGRAM_LAYERS);
  }

  return {
    schemaVersion: ver as CreationProtocolLayersSnapshot["schemaVersion"],
    capturedAt: o.capturedAt.trim(),
    documentationRef,
    layers,
    ...(nftCollectionLayers ? { nftCollectionLayers } : {}),
  };
}
