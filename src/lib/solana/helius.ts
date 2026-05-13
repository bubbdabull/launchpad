import "server-only";

import { getHeliusApiBaseUrl } from "./cluster";

/**
 * Helius enhanced API helpers (server-only).
 *
 * Why Helius matters for this product:
 *   1. Asset API (DAS) — list a wallet's Metaplex Core / Token Metadata NFTs
 *      in one call. Replaces having to query each asset individually.
 *      Used for "my Genesis Passes" view.
 *   2. Enhanced Transactions — parsed swap/mint events from a single tx hash.
 *      Used for showing a launch's recent activity feed.
 *   3. Webhooks — push notifications when a tracked account changes. Used to
 *      nudge cached launch rows (`collections.updated_at`) for background refresh.
 *
 * This module is the single home for those calls — keep them out of the rest
 * of the codebase so swapping providers later is one file.
 */

export type HeliusAsset = {
  id: string;
  content?: {
    metadata?: { name?: string; attributes?: Array<{ trait_type?: string; value?: string }> };
    json_uri?: string;
    files?: Array<{ uri: string; mime?: string }>;
  };
  ownership?: { owner: string };
  grouping?: Array<{ group_key: string; group_value: string }>;
  /** When fetched via DAS, attribute plugin data appears here. */
  inscription?: unknown;
  attributes?: Array<{ trait_type?: string; value?: string }>;
  /**
   * Metaplex Core plugin payload. Attribute data ends up under
   * `plugins.attributes.data.attribute_list` for Core assets fetched via DAS.
   */
  plugins?: {
    attributes?: {
      data?: {
        attribute_list?: Array<{ key?: string; value?: string }>;
      };
    };
  };
};

/** Metaplex Core collection mint for a grouped asset (DAS `grouping`). */
export function collectionMintFromHeliusAsset(asset: HeliusAsset): string | undefined {
  const g = asset.grouping?.find((x) => x.group_key === "collection");
  const v = g?.group_value?.trim();
  return v || undefined;
}

/**
 * Pull all attribute pairs out of an asset, regardless of where the indexer
 * placed them. Returns a single normalized list in `{ trait_type, value }`
 * form so downstream code only deals with one shape.
 *
 * Sources we consult, in priority order:
 *   1. Metaplex Core attributes plugin (`plugins.attributes.data.attribute_list`)
 *   2. Helius top-level `attributes` array
 *   3. JSON-metadata `content.metadata.attributes`
 */
export function getAssetAttributes(
  asset: HeliusAsset,
): Array<{ trait_type?: string; value?: string }> {
  const out: Array<{ trait_type?: string; value?: string }> = [];
  const coreAttrs = asset.plugins?.attributes?.data?.attribute_list;
  if (Array.isArray(coreAttrs)) {
    for (const a of coreAttrs) {
      out.push({ trait_type: a.key, value: a.value });
    }
  }
  if (Array.isArray(asset.attributes)) {
    for (const a of asset.attributes) {
      out.push({ trait_type: a.trait_type, value: a.value });
    }
  }
  const jsonAttrs = asset.content?.metadata?.attributes;
  if (Array.isArray(jsonAttrs)) {
    for (const a of jsonAttrs) {
      out.push({ trait_type: a.trait_type, value: a.value });
    }
  }
  return out;
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const url = getHeliusApiBaseUrl();
  if (!url) throw new Error("Helius API key not configured. Set HELIUS_API_KEY in .env.local.");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "lp",
      method,
      params,
    }),
  });

  if (!res.ok) throw new Error(`Helius ${method} HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(`Helius ${method}: ${json.error.message ?? "unknown error"}`);
  if (!json.result) throw new Error(`Helius ${method}: empty result`);
  return json.result;
}

/** List Metaplex Core (and other) NFTs owned by a wallet. */
export async function getAssetsByOwner(owner: string, opts?: { page?: number; limit?: number }) {
  return rpc<{ items: HeliusAsset[]; total: number; page: number }>("getAssetsByOwner", {
    ownerAddress: owner,
    page: opts?.page ?? 1,
    limit: opts?.limit ?? 100,
    displayOptions: { showCollectionMetadata: true, showInscription: true },
  });
}

/** List all NFTs minted under a specific collection (for "Holders" lists). */
export async function getAssetsByCollection(collection: string, opts?: { page?: number; limit?: number }) {
  return rpc<{ items: HeliusAsset[]; total: number; page: number }>("getAssetsByGroup", {
    groupKey: "collection",
    groupValue: collection,
    page: opts?.page ?? 1,
    limit: opts?.limit ?? 100,
    // Surface Core plugin data so downstream code can read on-chain attributes
    // (mintedAt, mintOrder, etc.) without an extra round-trip per asset.
    displayOptions: { showInscription: true, showCollectionMetadata: true },
  });
}

/** Fetch a single asset (used by /api/metadata to read on-chain attribute data). */
export async function getAsset(asset: string) {
  return rpc<HeliusAsset>("getAsset", { id: asset });
}
