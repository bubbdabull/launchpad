import type { TraitCollectionConfig } from "@/lib/nft-generation/types";

/**
 * Launch-level **display / art** config for generative Genesis Passes (L2 mirror + L3 metadata).
 * Does not affect MintReceipt, ClaimPosition, or holder reward math — cosmetic and URIs only.
 */
export type GenesisPassNftConfig = {
  /** When set, `/api/metadata/asset` hides generative traits and image until this instant (UTC). */
  revealAt?: string;
  /** Placeholder image (https) served as `image` while unrevealed. */
  placeholderImageUrl?: string;
  /** Optional https URL to a `trait-config.json` document (see `src/lib/nft-generation/schema/`). */
  traitConfigUri?: string;
  /** Inline trait config for small demos (prefer `traitConfigUri` in production). */
  traitConfig?: TraitCollectionConfig;
  /**
   * When true, after reveal time the dynamic `/api/metadata/asset` response may still be used,
   * but creators are encouraged to call `update` on the Core asset to a **pinned** immutable URI.
   */
  allowDynamicPostReveal?: boolean;
};
