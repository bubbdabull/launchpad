import "server-only";

import sharp from "sharp";

import { COLLECTION_IMAGE_OUTPUT, humanCollectionImageOutputLabel } from "@/lib/images/collection-image-output-spec";
import type { CollectionAssetKind } from "@/lib/supabase/collection-asset-storage";

const { logoPx: LOGO_SIZE, bannerWidth: BANNER_WIDTH, bannerHeight: BANNER_HEIGHT, galleryMaxEdge: GALLERY_MAX_EDGE } =
  COLLECTION_IMAGE_OUTPUT;

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
  return humanCollectionImageOutputLabel(kind);
}
