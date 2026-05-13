/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { normalizeCollectionImageForMetadata } from "@/lib/images/normalize-collection-image";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";
import type { CollectionAssetKind } from "@/lib/supabase/collection-asset-storage";
import {
  uploadCollectionAssetBuffer,
  uploadTraitConfigJsonBuffer,
} from "@/lib/supabase/collection-asset-storage";
import { createServiceRoleClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "upload:collection",
    max: envPositiveInt("RATE_LIMIT_COLLECTION_UPLOAD_MAX", 24),
    windowMs: envPositiveInt("RATE_LIMIT_COLLECTION_UPLOAD_WINDOW_MS", 15 * 60 * 1000),
  });
  if (limited) return limited;

  const session = await getWalletSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to upload files." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: "File uploads aren’t configured on this server yet." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data." }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "");
  if (kind !== "banner" && kind !== "logo" && kind !== "gallery" && kind !== "genesis-trait-config") {
    return NextResponse.json({ ok: false, error: "Invalid upload type." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: kind === "genesis-trait-config" ? "Choose a JSON file." : "Choose an image file." },
      { status: 400 },
    );
  }

  if (kind === "genesis-trait-config") {
    const name = file.name.toLowerCase();
    const looksJson = name.endsWith(".json") || file.type === "application/json" || file.type === "text/json";
    if (!looksJson) {
      return NextResponse.json({ ok: false, error: "Upload a .json file (trait-config.json)." }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "JSON must be 2 MB or smaller." }, { status: 400 });
    }
    const raw = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadTraitConfigJsonBuffer(supabase, {
      walletAddress: session.address,
      buffer: raw,
    });
    if (!uploaded.ok) {
      return NextResponse.json({ ok: false, error: uploaded.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, publicUrl: uploaded.publicUrl });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Image must be 5 MB or smaller." }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const normalized = await normalizeCollectionImageForMetadata(kind as CollectionAssetKind, raw);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }
  const uploaded = await uploadCollectionAssetBuffer(supabase, {
    walletAddress: session.address,
    kind: kind as CollectionAssetKind,
    buffer: normalized.buffer,
    contentType: "image/png",
  });

  if (!uploaded.ok) {
    return NextResponse.json({ ok: false, error: uploaded.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, publicUrl: uploaded.publicUrl });
}
