/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { DEFAULT_AI_MODEL, getOpenAi } from "@/lib/ai/openai";
import { getWalletSession } from "@/lib/auth/session";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";

const FIELDS = ["story", "roadmap", "community"] as const;
type Field = (typeof FIELDS)[number];

function fieldInstructions(field: Field): string {
  switch (field) {
    case "story":
      return `Write ONLY the "Story" section: lore, world-building, and why this drop exists. plain sentences, no title line, no "Story:" prefix.`;
    case "roadmap":
      return `Write ONLY the "Roadmap" section: phases, milestones, what ships after the Alpha Vault completes and DAMM v2 is live. plain sentences, no title line, no "Roadmap:" prefix.`;
    case "community":
      return `Write ONLY the "Community" section: holder perks, events, how people plug in (Discord roles, spaces, governance). plain sentences, no title line, no "Community:" prefix.`;
  }
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string", maxLength: 2500 },
  },
} as const;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "ai:metadata-field",
    max: envPositiveInt("RATE_LIMIT_AI_METADATA_FIELD_MAX", 12),
    windowMs: envPositiveInt("RATE_LIMIT_AI_METADATA_FIELD_WINDOW_MS", 15 * 60 * 1000),
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
    field?: unknown;
    launchName?: unknown;
    tagline?: unknown;
    description?: unknown;
    styleHint?: unknown;
    existingDraft?: unknown;
    otherSections?: unknown;
  };

  const fieldRaw = String(b.field ?? "").toLowerCase();
  if (!FIELDS.includes(fieldRaw as Field)) {
    return bad('field must be "story", "roadmap", or "community".');
  }
  const field = fieldRaw as Field;

  const launchName = String(b.launchName ?? "").trim();
  if (!launchName) return bad("Add a launch name first.");
  if (launchName.length > 96) return bad("Launch name is too long.");

  const tagline = String(b.tagline ?? "").trim().slice(0, 220);
  const description = String(b.description ?? "").trim().slice(0, 4000);
  const styleHint = String(b.styleHint ?? "").trim().slice(0, 300);
  const existingDraft = String(b.existingDraft ?? "").trim().slice(0, 2500);
  const otherSections = String(b.otherSections ?? "").trim().slice(0, 4000);

  if (!description) return bad("Add a main description in step 01 first — the AI uses it for context.");

  let openai;
  try {
    openai = getOpenAi();
  } catch (e) {
    return bad(e instanceof Error ? e.message : "OpenAI is not configured.", 503);
  }

  const system = `You help Solana creators write one section of token/NFT metadata shown on DEX explorers and wallets.
Rules:
- Plain sentences only — no markdown, no bullet characters, no hashtags, no emojis.
- Do not repeat the main description verbatim; expand it.
- Stay factual to the hints; no guaranteed returns or fake partnerships.
- ${fieldInstructions(field)}
- If an existing draft is provided, improve and complete it rather than replacing with unrelated text unless the draft is empty.`;

  const userParts = [
    `Launch name: ${launchName}`,
    tagline ? `Tagline: ${tagline}` : null,
    `Main description:\n${description}`,
    styleHint ? `Tone / style hint: ${styleHint}` : null,
    otherSections ? `Other metadata sections (for consistency, do not duplicate):\n${otherSections}` : null,
    existingDraft ? `Current draft to refine:\n${existingDraft}` : null,
  ].filter(Boolean);

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_AI_MODEL,
      temperature: 0.55,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n\n") },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "metadata_field",
          strict: true,
          schema: SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return bad("OpenAI returned an empty response.", 502);

    const parsed = JSON.parse(content) as { text: string };
    return NextResponse.json({ ok: true, data: { text: parsed.text.trim() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed.";
    return bad(message, 500);
  }
}
