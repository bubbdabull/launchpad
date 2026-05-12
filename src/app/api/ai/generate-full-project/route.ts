/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { buildLaunchImagePrompt } from "@/lib/ai/launch-image-prompt";
import { DEFAULT_AI_MODEL, getOpenAi } from "@/lib/ai/openai";
import { getWalletSession } from "@/lib/auth/session";
import { normalizeCollectionImageForMetadata } from "@/lib/images/normalize-collection-image";
import type { FullProjectCopy } from "@/lib/ai/full-project-copy";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";
import type { CollectionAssetKind } from "@/lib/supabase/collection-asset-storage";
import { uploadCollectionAssetBuffer } from "@/lib/supabase/collection-asset-storage";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const SYSTEM = `You are a Solana NFT + token launchpad strategist and copywriter.

The creator provides ONLY:
1) Launch / project name
2) A short project description (their vision, audience, vibe)

Your job: output EVERYTHING needed to publish a launch form — polished listing copy, token symbol, realistic NFT supply and flat mint price (same price for every Genesis Pass), utilities, vesting knobs, phase label, visual style hint for AI art, rich explorer sections (story / roadmap / community), and suggested holder-reward split.

Rules:
- Expand their description into a compelling long-form "description" field (3–8 sentences) suitable for the main mint page. Preserve their intent; do not invent fake partnerships, guarantees, or legal claims.
- "tagline": one sentence, max 90 chars, no quotes.
- "tokenSymbol": 2–10 uppercase A–Z / digits only.
- Numbers must satisfy the JSON schema bounds.
- "story", "roadmap", "community": plain sentences, no markdown bullets, no emojis — these append in token metadata JSON.
- "styleHint": concise art direction for DALL·E (max ~200 chars): palette, genre, mood (e.g. "neon cyberpunk cats, chrome highlights").
- Mint pricing is always flat: one suggestedMintPriceSol per NFT (fair launch / Alpha Vault primary).
- Project-page only (does not affect home grid / trade): "projectAccentHex" is a vibrant #RGB or #RRGGBB that matches the vibe, or "" for platform default. "projectHeroLayout": classic (banner + logo overlay) unless a clean editorial look fits minimal, or split when a wide banner + side column reads better.
- "projectPageHeadline" / "projectPageSubhead": optional strings for /project/[slug] hero; use "" to fall back to launch name / tagline. Subhead should be one tight line.
- "projectHideDefaultDescription": true when projectTextBlocks already cover the long description (avoid duplicate prose). "projectHideDefaultStats": usually false; true only for a very minimal story-only page.
- "projectTextBlocks": 2–5 entries with distinct headings and 2–5 sentence bodies each; plain text, no markdown; expand story/roadmap/community themes without copying the full listing description verbatim.
- "projectFaq": 0–4 realistic collector questions; use [] if none fit.`;

const COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "tagline",
    "description",
    "tokenSymbol",
    "suggestedSupply",
    "suggestedMintPriceSol",
    "utilities",
    "creatorVestingSupplyPct",
    "creatorVestingCliffMonths",
    "creatorVestingPeriodMonths",
    "tokenHolderRewardPct",
    "styleHint",
    "phase",
    "story",
    "roadmap",
    "community",
    "holderRewardPct",
    "projectAccentHex",
    "projectHeroLayout",
    "projectPageHeadline",
    "projectPageSubhead",
    "projectHideDefaultDescription",
    "projectHideDefaultStats",
    "projectTextBlocks",
    "projectFaq",
  ],
  properties: {
    tagline: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 4000 },
    tokenSymbol: { type: "string", pattern: "^[A-Z0-9]{2,10}$" },
    suggestedSupply: { type: "integer", minimum: 1, maximum: 10000 },
    suggestedMintPriceSol: { type: "number", minimum: 0, maximum: 100 },
    utilities: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", maxLength: 32 },
    },
    creatorVestingSupplyPct: { type: "integer", minimum: 0, maximum: 25 },
    creatorVestingCliffMonths: { type: "integer", minimum: 0, maximum: 12 },
    creatorVestingPeriodMonths: { type: "integer", minimum: 3, maximum: 24 },
    tokenHolderRewardPct: { type: "integer", minimum: 0, maximum: 100 },
    styleHint: { type: "string", maxLength: 300 },
    phase: { type: "string", maxLength: 64 },
    story: { type: "string", maxLength: 2000 },
    roadmap: { type: "string", maxLength: 2000 },
    community: { type: "string", maxLength: 2000 },
    holderRewardPct: { type: "integer", minimum: 0, maximum: 100 },
    projectAccentHex: {
      type: "string",
      maxLength: 7,
      pattern: "^(|#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}))$",
    },
    projectHeroLayout: {
      type: "string",
      enum: ["classic", "minimal", "split"],
    },
    projectPageHeadline: { type: "string", maxLength: 200 },
    projectPageSubhead: { type: "string", maxLength: 400 },
    projectHideDefaultDescription: { type: "boolean" },
    projectHideDefaultStats: { type: "boolean" },
    projectTextBlocks: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body"],
        properties: {
          heading: { type: "string", maxLength: 200 },
          body: { type: "string", maxLength: 3000 },
        },
      },
    },
    projectFaq: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string", maxLength: 280 },
          answer: { type: "string", maxLength: 500 },
        },
      },
    },
  },
} as const;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

async function generateOneImage(input: {
  openai: Awaited<ReturnType<typeof getOpenAi>>;
  supabase: ReturnType<typeof createServiceRoleClient>;
  walletAddress: string;
  kind: "banner" | "logo" | "gallery";
  launchName: string;
  tagline: string;
  description: string;
  styleHint: string;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const prompt = buildLaunchImagePrompt({
    kind: input.kind,
    launchName: input.launchName,
    tagline: input.tagline,
    description: input.description,
    styleHint: input.styleHint,
  });
  try {
    const size = input.kind === "logo" ? "1024x1024" : "1792x1024";
    const gen = await input.openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "url",
    });
    const imageUrl = gen.data?.[0]?.url;
    if (!imageUrl) return { ok: false, error: "No image URL from model." };
    const res = await fetch(imageUrl);
    if (!res.ok) return { ok: false, error: `Download failed HTTP ${res.status}` };
    const bytes = await res.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const normalized = await normalizeCollectionImageForMetadata(input.kind as CollectionAssetKind, buffer);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    const uploaded = await uploadCollectionAssetBuffer(input.supabase, {
      walletAddress: input.walletAddress,
      kind: input.kind as CollectionAssetKind,
      buffer: normalized.buffer,
      contentType: "image/png",
    });
    if (!uploaded.ok) return { ok: false, error: uploaded.error };
    return { ok: true, publicUrl: uploaded.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Image step failed." };
  }
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "ai:full-project",
    max: envPositiveInt("RATE_LIMIT_AI_FULL_PROJECT_MAX", 3),
    windowMs: envPositiveInt("RATE_LIMIT_AI_FULL_PROJECT_WINDOW_MS", 60 * 60 * 1000),
  });
  if (limited) return limited;

  const session = await getWalletSession();
  if (!session) return bad("Sign in with your wallet first.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const projectName = String((body as { projectName?: unknown }).projectName ?? "").trim();
  const projectDescription = String((body as { projectDescription?: unknown }).projectDescription ?? "").trim();

  if (!projectName) return bad("Add a launch name.");
  if (projectName.length > 96) return bad("Launch name is too long.");
  if (!projectDescription) return bad("Add a short project description — what are you building?");
  if (projectDescription.length < 12) return bad("Description should be at least ~12 characters so the AI has context.");
  if (projectDescription.length > 8000) return bad("Description is too long (max 8000 characters).");

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

  let copy: FullProjectCopy;
  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_AI_MODEL,
      temperature: 0.75,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Launch name: ${projectName}\n\nCreator project description:\n${projectDescription}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "full_project",
          strict: true,
          schema: COPY_SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return bad("OpenAI returned empty copy.", 502);
    copy = JSON.parse(content) as FullProjectCopy;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate copy.";
    return bad(message, 500);
  }

  const tagline = copy.tagline.trim();
  const description = copy.description.trim();
  const styleHint = copy.styleHint.trim();

  const imageErrors: string[] = [];
  let bannerUrl: string | undefined;
  let logoUrl: string | undefined;
  let galleryUrl: string | undefined;

  const kinds = ["banner", "logo", "gallery"] as const;
  for (const kind of kinds) {
    const r = await generateOneImage({
      openai,
      supabase,
      walletAddress: session.address,
      kind,
      launchName: projectName,
      tagline,
      description,
      styleHint,
    });
    if (!r.ok) {
      imageErrors.push(`${kind}: ${r.error}`);
      continue;
    }
    if (kind === "banner") bannerUrl = r.publicUrl;
    if (kind === "logo") logoUrl = r.publicUrl;
    if (kind === "gallery") galleryUrl = r.publicUrl;
  }

  return NextResponse.json({
    ok: true,
    data: {
      copy,
      images: {
        bannerUrl: bannerUrl ?? null,
        logoUrl: logoUrl ?? null,
        galleryUrl: galleryUrl ?? null,
      },
      imageErrors: imageErrors.length ? imageErrors : undefined,
    },
  });
}
