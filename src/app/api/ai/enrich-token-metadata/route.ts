/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { DEFAULT_AI_MODEL, getOpenAi } from "@/lib/ai/openai";
import { getWalletSession } from "@/lib/auth/session";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["story", "roadmap", "community"],
  properties: {
    story: { type: "string", maxLength: 2000 },
    roadmap: { type: "string", maxLength: 2000 },
    community: { type: "string", maxLength: 2000 },
  },
} as const;

const SYSTEM = `You draft three plain-text sections for Solana token + NFT metadata JSON.
They will be appended after the main launch description in wallets and DEX explorers.

Rules:
- Plain sentences only — no markdown, no bullet characters, no hashtags, no emojis.
- Each section must be distinct: story = narrative and world; roadmap = phases and milestones; community = how holders engage (Discord roles, events, governance).
- Do not repeat the main description verbatim; expand and complement it.
- Stay factual to the hints given; do not invent legal claims, guaranteed returns, or fake partnerships.
- Each string: at least 2 sentences when the user gave enough context; otherwise 2 short sentences each.`;

export type EnrichTokenMetadataResult = {
  story: string;
  roadmap: string;
  community: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "ai:token-metadata-enrich",
    max: envPositiveInt("RATE_LIMIT_AI_METADATA_ENRICH_MAX", 6),
    windowMs: envPositiveInt("RATE_LIMIT_AI_METADATA_ENRICH_WINDOW_MS", 15 * 60 * 1000),
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

  const b = body as {
    launchName?: unknown;
    tagline?: unknown;
    description?: unknown;
    styleHint?: unknown;
  };
  const launchName = String(b.launchName ?? "").trim();
  if (!launchName) return bad("Add a launch name first.");
  if (launchName.length > 96) return bad("Launch name is too long.");

  const tagline = String(b.tagline ?? "").trim().slice(0, 220);
  const description = String(b.description ?? "").trim().slice(0, 4000);
  const styleHint = String(b.styleHint ?? "").trim().slice(0, 300);

  if (!description) return bad("Add a main description in step 01 so the model can extend it.");

  let openai;
  try {
    openai = getOpenAi();
  } catch (e) {
    return bad(e instanceof Error ? e.message : "OpenAI is not configured.", 503);
  }

  const userBlock = [
    `Launch name: ${launchName}`,
    tagline ? `Tagline: ${tagline}` : null,
    `Main description:\n${description}`,
    styleHint ? `Visual / tone hint: ${styleHint}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_AI_MODEL,
      temperature: 0.65,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "token_metadata_enrich",
          strict: true,
          schema: SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return bad("OpenAI returned an empty response.", 502);

    const parsed = JSON.parse(content) as EnrichTokenMetadataResult;
    return NextResponse.json({ ok: true, data: parsed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed.";
    return bad(message, 500);
  }
}
