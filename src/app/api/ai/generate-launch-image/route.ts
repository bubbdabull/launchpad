/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { buildLaunchImagePrompt } from "@/lib/ai/launch-image-prompt";
import { getOpenAi } from "@/lib/ai/openai";
import { getWalletSession } from "@/lib/auth/session";
import { normalizeCollectionImageForMetadata } from "@/lib/images/normalize-collection-image";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";
import type { CollectionAssetKind } from "@/lib/supabase/collection-asset-storage";
import { uploadCollectionAssetBuffer } from "@/lib/supabase/collection-asset-storage";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 120;

type Body = {
  kind?: unknown;
  launchName?: unknown;
  tagline?: unknown;
  description?: unknown;
  styleHint?: unknown;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "ai:launch-image",
    max: envPositiveInt("RATE_LIMIT_AI_LAUNCH_IMAGE_MAX", 8),
    windowMs: envPositiveInt("RATE_LIMIT_AI_LAUNCH_IMAGE_WINDOW_MS", 15 * 60 * 1000),
  });
  if (limited) return limited;

  const session = await getWalletSession();
  if (!session) return bad("Sign in with your wallet first.", 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid JSON body.");
  }

  const kind = String(body.kind ?? "");
  if (kind !== "banner" && kind !== "logo" && kind !== "gallery") {
    return bad('kind must be "banner", "logo", or "gallery".');
  }

  const launchName = String(body.launchName ?? "").trim();
  if (!launchName) return bad("Add a launch name first so the art can match your drop.");

  const tagline = String(body.tagline ?? "").trim();
  const description = String(body.description ?? "").trim();
  const styleHint = String(body.styleHint ?? "").trim();

  let openai;
  try {
    openai = getOpenAi();
  } catch (e) {
    return bad(e instanceof Error ? e.message : "OpenAI is not configured.", 503);
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return bad("Image hosting isn’t configured (Supabase service role).", 503);
  }

  const prompt = buildLaunchImagePrompt({ kind: kind as "banner" | "logo" | "gallery", launchName, tagline, description, styleHint });

  let imageUrl: string | undefined;
  try {
    const size = kind === "logo" ? "1024x1024" : "1792x1024";
    const gen = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "url",
    });
    imageUrl = gen.data?.[0]?.url ?? undefined;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Image generation failed.";
    return bad(msg, 502);
  }

  if (!imageUrl) return bad("No image URL returned from the model.", 502);

  let bytes: ArrayBuffer;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return bad(`Could not download generated image (HTTP ${res.status}).`, 502);
    bytes = await res.arrayBuffer();
  } catch {
    return bad("Could not download generated image.", 502);
  }

  const buffer = Buffer.from(bytes);
  const normalized = await normalizeCollectionImageForMetadata(kind as CollectionAssetKind, buffer);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, message: normalized.error }, { status: 502 });
  }
  const uploaded = await uploadCollectionAssetBuffer(supabase, {
    walletAddress: session.address,
    kind: kind as CollectionAssetKind,
    buffer: normalized.buffer,
    contentType: "image/png",
  });

  if (!uploaded.ok) {
    return NextResponse.json({ ok: false, message: uploaded.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, publicUrl: uploaded.publicUrl });
}
