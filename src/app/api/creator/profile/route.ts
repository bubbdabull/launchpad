/**
 * @apiRouteLayer L3
 * GET  /api/creator/profile?wallet=<base58>  — public read of any profile
 * POST /api/creator/profile                  — authenticated upsert of own profile
 *
 * The signed-in wallet can update display_name / bio / handles / avatar.
 * It cannot flip the `verified` bit — that's reserved for the admin
 * route. We deliberately allow self-edit of all other fields.
 */



import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { getCreatorProfile } from "@/lib/creators/profiles";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") ?? "";
  if (!BASE58_RE.test(wallet)) return bad("Bad wallet.");
  const profile = await getCreatorProfile(wallet);
  return NextResponse.json({ ok: true, profile });
}

const MAX_BIO = 1024;
const MAX_NAME = 64;
const MAX_HANDLE = 64;
const MAX_URL = 256;

function clampString(v: unknown, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, { prefix: "creator_profile", max: 20, windowMs: 60_000 });
  if (limited) return limited;

  const session = await getWalletSession();
  if (!session) return bad("Wallet sign-in required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON.");
  }

  // Only allow editing one's own profile.
  const targetWallet = session.address;

  const update = {
    wallet: targetWallet,
    display_name: clampString(body.displayName, MAX_NAME),
    bio: clampString(body.bio, MAX_BIO),
    avatar_url: clampString(body.avatarUrl, MAX_URL),
    twitter_handle: clampString(body.twitterHandle, MAX_HANDLE),
    discord_handle: clampString(body.discordHandle, MAX_HANDLE),
    website_url: clampString(body.websiteUrl, MAX_URL),
  };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("creator_profiles")
    .upsert(update, { onConflict: "wallet" });
  if (error) return bad(error.message, 500);

  const profile = await getCreatorProfile(targetWallet);
  return NextResponse.json({ ok: true, profile });
}
