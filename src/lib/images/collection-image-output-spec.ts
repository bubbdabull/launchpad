/**
 * Output dimensions after `normalizeCollectionImageForMetadata` (sharp).
 * Shared by the upload API and client copy so creators see accurate targets.
 */
export const COLLECTION_IMAGE_OUTPUT = {
  logoPx: 512,
  bannerWidth: 1920,
  bannerHeight: 640,
  galleryMaxEdge: 1600,
} as const;

export type CollectionImageNormalizeKind = "banner" | "logo" | "gallery";

export function humanCollectionImageOutputLabel(kind: CollectionImageNormalizeKind): string {
  const o = COLLECTION_IMAGE_OUTPUT;
  if (kind === "logo") return `${o.logoPx}×${o.logoPx} PNG`;
  if (kind === "banner") return `${o.bannerWidth}×${o.bannerHeight} PNG`;
  return `max ${o.galleryMaxEdge}px PNG (no upscaling)`;
}
