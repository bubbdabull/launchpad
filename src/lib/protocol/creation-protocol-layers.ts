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

/** Canonical platform L1/L2/L3 (UI + DB). */
export const CREATION_PROTOCOL_LAYERS: readonly CreationProtocolLayer[] = [
  {
    id: "L1",
    title: "Layer 1 — On-chain protocol (authoritative)",
    subtitle: "Solana programs + Meteora + Metaplex Core",
    responsibilities: [
      "Anchor launch-controller: lifecycle, receipts, claims, vesting, custody.",
      "Meteora Alpha Vault: primary-sale deposits / raise.",
      "Meteora DAMM v2: swaps and pool liquidity execution.",
      "Metaplex Core: Genesis Pass identity and collection binding.",
    ],
    boundaries: [
      "Ownership, allocations, claims, and phase come only from signed transactions and on-chain state.",
      "This app and Supabase do not override program rules.",
    ],
  },
  {
    id: "L2",
    title: "Layer 2 — Indexer & mirrors (read-mostly)",
    subtitle: "Helius streams, Supabase rollups, analytics",
    responsibilities: [
      "Ingest chain events into cache / audit tables for UX and dashboards.",
      "Trending, volume, APR-style displays over mirrored data.",
    ],
    boundaries: [
      "May rank, aggregate, and filter — must not decide payouts, claims, allocations, or lifecycle.",
    ],
  },
  {
    id: "L3",
    title: "Layer 3 — Product & coordination (UX)",
    subtitle: "Next.js, wallet sessions, uploads, unsigned tx builders",
    responsibilities: [
      "Discovery, create launch, mint pages, metadata URIs, deploy helpers.",
      "Build unsigned transactions from program layout — you sign with your wallet.",
    ],
    boundaries: [
      "Display and coordination only — not a second source of truth for token economics.",
    ],
  },
] as const;

/**
 * Genesis Pass / NFT collection: variation (trait) settings and holder-facing surfaces,
 * expressed in the same L1/L2/L3 shape. Configured in this app on create / manage; L1 holds mint + metadata authority outcomes.
 */
export const NFT_COLLECTION_PROGRAM_LAYERS: readonly CreationProtocolLayer[] = [
  {
    id: "L1",
    title: "L1 — Core collection & asset truth",
    subtitle: "Metaplex Core + SPL receipts on Solana",
    responsibilities: [
      "Genesis Pass collection parent + per-asset accounts: what is minted, owned, and bound to your launch.",
      "Metadata URI updates when you reveal or refresh art (signed transactions, not this form alone).",
      "Mint limits, price, and Alpha Vault deposits enforced by programs you deploy from the Trade page.",
    ],
    boundaries: [
      "Trait rarity weights in JSON do not live on-chain as a spreadsheet — the chain stores URIs + collection wiring; your trait-config file is referenced off-chain until you commit URI changes.",
    ],
  },
  {
    id: "L2",
    title: "L2 — Mirrors & holder counts",
    subtitle: "Helius DAS, Supabase rows, gallery caches",
    responsibilities: [
      "Holder counts, volume, and pass lists for cards and dashboards.",
      "Cached copies of `trait-config.json` URLs, placeholder art links, and rarity listing URLs you save here.",
    ],
    boundaries: [
      "Does not decide who is entitled to claims — only reflects chain + audit rows.",
    ],
  },
  {
    id: "L3",
    title: "L3 — All in this app (create + manage)",
    subtitle: "Variation settings, NFT art, mint UX",
    responsibilities: [
      "This create flow: NFT art gallery, trait-config URI, placeholder while unrevealed, reveal schedule, rarity page link, optional dynamic URI toggle.",
      "Manage: edit the same fields, preview endpoints, mint page — you never leave the launchpad for collection marketing setup.",
      "Holders see mint progress, links, and generative previews here; they verify wallets and NFTs on explorers.",
    ],
    boundaries: [
      "Cosmetic / metadata configuration only — no substitute for signing deploy + reveal transactions when you go live.",
    ],
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

/** Layers to show for the NFT / Genesis program card (stored snapshot or current canonical). */
export function nftCollectionLayersForDisplay(snapshot: CreationProtocolLayersSnapshot | null | undefined) {
  if (snapshot?.nftCollectionLayers?.length === 3) return snapshot.nftCollectionLayers;
  return cloneLayers(NFT_COLLECTION_PROGRAM_LAYERS);
}
