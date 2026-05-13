import "server-only";

import sharp from "sharp";

import type { CollectionAssetKind } from "@/lib/supabase/collection-asset-storage";

/** Primary token / NFT icon — wallets and DEXs expect a crisp square. */
const LOGO_SIZE = 512;
/** Wide hero (~3:1) used by launch pages and many indexers. */
const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 640;
/** Gallery stills — cap long edge so metadata stays light. */
const GALLERY_MAX_EDGE = 1600;

const MAX_OUT_BYTES = 5 * 1024 * 1024;

/**
 * Resize + encode to PNG so on-chain metadata URIs always point at
 * predictable dimensions (wallets, Phantom, DEXScreener, etc.).
 */
export async function normalizeCollectionImageForMetadata(
  kind: CollectionAssetKind,
  input: Buffer,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  try {
    const pipeline = sharp(input).rotate();

    let out: Buffer;
    if (kind === "logo") {
      out = await pipeline
        .resize(LOGO_SIZE, LOGO_SIZE, { fit: "cover", position: "centre" })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else if (kind === "banner") {
      out = await pipeline
        .resize(BANNER_WIDTH, BANNER_HEIGHT, { fit: "cover", position: "centre" })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else {
      // gallery: never upscale; shrink if too large for sane loads.
      const meta = await pipeline.metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (!w || !h) {
        return { ok: false, error: "Could not read image dimensions (file may be corrupt)." };
      }
      const long = Math.max(w, h);
      if (long <= GALLERY_MAX_EDGE) {
        out = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      } else {
        out = await pipeline
          .resize(GALLERY_MAX_EDGE, GALLERY_MAX_EDGE, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();
      }
    }

    if (out.length > MAX_OUT_BYTES) {
      return {
        ok: false,
        error: `Processed image is still over ${MAX_OUT_BYTES / (1024 * 1024)} MB — use a smaller source.`,
      };
    }
    return { ok: true, buffer: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not process image.";
    return { ok: false, error: msg.includes("Input") ? "Invalid or unsupported image file." : msg };
  }
}

export function collectionImageTargetLabel(kind: CollectionAssetKind): string {
  if (kind === "logo") return `${LOGO_SIZE}×${LOGO_SIZE} PNG`;
  if (kind === "banner") return `${BANNER_WIDTH}×${BANNER_HEIGHT} PNG`;
  if (kind === "gallery") return `max ${GALLERY_MAX_EDGE}px PNG`;
  return "PNG";
}
