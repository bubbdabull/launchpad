/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { DEFAULT_AI_MODEL, getOpenAi } from "@/lib/ai/openai";

const SYSTEM_PROMPT = `You are a launchpad copywriter for a Solana NFT + token launchpad.
Each launch pairs a Genesis Pass NFT (Metaplex Core) with a SPL token whose primary sales flow through a Meteora Alpha Vault; secondary liquidity is on DAMM v2.

Given just a launch name, produce concise, high-energy launch copy plus reasonable defaults.
Match the tone to the name (cute meme, cyberpunk, generative art, etc).

Rules:
- "tagline": one sentence, max 90 chars, hook-y, no quotes
- "description": 2–4 sentences explaining the NFT collection, paired token, and what holders get. Mention Alpha Vault primary mint + eventual DAMM liquidity if it fits. Max 600 chars.
- "tokenSymbol": 2–10 uppercase letters/numbers, no $ prefix
- "suggestedSupply": realistic NFT count (10–10,000). Smaller (10–500) for premium drops, larger (1k–5k) for memecoin/PFP drops.
- "suggestedMintPriceSol": 0.05–10 SOL per NFT. Total supply × price should stay plausible for a vault raise (avoid absurd totals).
- "utilities": 3 short bullet phrases (≤ 24 chars each), e.g. "Fee share", "Vault mint", "Squad allowlist"
- "creatorVestingSupplyPct": 0–25. % of the 1B token supply locked for the creator after unlock schedule. Pick something modest (5–15) for community-friendly drops, 0 for fully fair-launch.
- "creatorVestingCliffMonths": 0–12. Wait time before unlock waves begin. Most drops do 0 or 1.
- "creatorVestingPeriodMonths": 3–24. Length of linear unlock. 6–12 is typical.
- "tokenHolderRewardPct": 0–100. % of each vesting wave the creator commits to airdrop pro-rata to Genesis Pass holders. For loyalty-heavy drops use 25–50; for solo creators use 0.
- Mint pricing is always flat: one "suggestedMintPriceSol" per Genesis Pass (no phases or tier lists).`;

const SCHEMA = {
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
  ],
  properties: {
    tagline: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 800 },
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
  },
} as const;

export type LaunchAssistResult = {
  tagline: string;
  description: string;
  tokenSymbol: string;
  suggestedSupply: number;
  suggestedMintPriceSol: number;
  utilities: [string, string, string];
  creatorVestingSupplyPct: number;
  creatorVestingCliffMonths: number;
  creatorVestingPeriodMonths: number;
  tokenHolderRewardPct: number;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  const session = await getWalletSession();
  if (!session) return bad("Sign in with your wallet first.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const name = String((body as { name?: unknown })?.name ?? "").trim();
  if (!name) return bad("Provide a launch name.");
  if (name.length > 80) return bad("Launch name must be 80 characters or fewer.");

  let openai;
  try {
    openai = getOpenAi();
  } catch (e) {
    return bad(e instanceof Error ? e.message : "OpenAI is not configured.", 503);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_AI_MODEL,
      temperature: 0.8,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Launch name: ${name}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "launch_assist",
          strict: true,
          schema: SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return bad("OpenAI returned an empty response.", 502);

    const parsed = JSON.parse(content) as LaunchAssistResult;

    return NextResponse.json({ ok: true, data: parsed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed.";
    return bad(message, 500);
  }
}
