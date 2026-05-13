import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type CollectionAssetKind = "banner" | "logo" | "gallery";

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
  const objectPath = `${wallet}/${Date.now()}-${kind}.${ext}`;
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

const TRAIT_JSON_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Upload `trait-config.json` to the public collection-assets bucket (same bucket as images).
 * Validates UTF-8 JSON before storing.
 */
export async function uploadTraitConfigJsonBuffer(
  supabase: SupabaseClient,
  params: { walletAddress: string; buffer: Buffer },
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const { walletAddress, buffer } = params;
  if (buffer.length > TRAIT_JSON_MAX_BYTES) {
    return { ok: false, error: "trait-config.json must be 2 MB or smaller." };
  }
  let text: string;
  try {
    text = buffer.toString("utf8");
  } catch {
    return { ok: false, error: "Could not read JSON file as UTF-8." };
  }
  try {
    JSON.parse(text);
  } catch {
    return { ok: false, error: "File must be valid JSON (trait-config.json)." };
  }

  const wallet = walletAddress.replace(/^0x/i, "").toLowerCase().slice(0, 40);
  const objectPath = `${wallet}/${Date.now()}-trait-config.json`;
  const bucket = collectionAssetsBucketName();

  const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: "application/json",
    upsert: false,
  });

  if (upErr) {
    const msg = upErr.message.includes("Bucket not found")
      ? "Hosting isn’t ready yet — paste a public https:// link to your JSON instead."
      : "Couldn’t upload. Try again or paste a link instead.";
    return { ok: false, error: msg };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    return { ok: false, error: "Upload saved but public URL failed." };
  }

  return { ok: true, publicUrl: data.publicUrl };
}
