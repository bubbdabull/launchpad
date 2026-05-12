import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type CollectionAssetKind = "banner" | "logo" | "gallery" | "store";

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export function collectionAssetsBucketName(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "collection-assets";
}

/**
 * Upload raw image bytes to the public `collection-assets` bucket (same as
 * `/api/upload/collection-asset`).
 */
export async function uploadCollectionAssetBuffer(
  supabase: SupabaseClient,
  params: {
    walletAddress: string;
    kind: CollectionAssetKind;
    buffer: Buffer;
    contentType: string;
  },
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const { walletAddress, kind, buffer, contentType } = params;
  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }
  if (!ALLOWED.has(contentType)) {
    return { ok: false, error: "Use JPG, PNG, WebP, or GIF." };
  }

  const wallet = walletAddress.replace(/^0x/i, "").toLowerCase().slice(0, 40);
  const ext = extForMime(contentType);
  const objectPath =
    kind === "store"
      ? `store-products/${wallet}/${Date.now()}.${ext}`
      : `${wallet}/${Date.now()}-${kind}.${ext}`;
  const bucket = collectionAssetsBucketName();

  const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });

  if (upErr) {
    const msg = upErr.message.includes("Bucket not found")
      ? "Image hosting isn’t ready yet — use “Paste image link” instead, or contact support."
      : "Couldn’t upload. Try again or paste an image link instead.";
    return { ok: false, error: msg };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    return { ok: false, error: "Upload saved but public URL failed." };
  }

  return { ok: true, publicUrl: data.publicUrl };
}
