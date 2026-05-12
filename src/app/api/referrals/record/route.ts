/**
 * @apiRouteLayer L2
 * POST /api/referrals/record
 *
 * Called by the mint flow right after a Genesis Pass mint confirms.
 * Inputs (JSON):
 *   - slug:           collection slug
 *   - mintSignature:  the confirmed Solana tx signature
 *   - referredWallet: the buyer's wallet (we cross-check vs session)
 *
 * The referrer wallet comes from the `lp_ref` cookie set in the Next.js proxy.
 * We trust the cookie because it can only be written by the server in
 * response to an explicit `?ref=` URL param.
 *
 * Auth: requires a SIWS wallet session for the referredWallet; we don't
 * accept arbitrary record requests because that lets a referrer credit
 * themselves with mints that didn't happen.
 *
 * The endpoint is idempotent — the schema enforces UNIQUE(referred_wallet,
 * collection_slug), so a duplicate submission for the same buyer + launch
 * is silently a no-op.
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";


import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getWalletSession } from "@/lib/auth/session";
import { REFERRAL_COOKIE, sanitizeReferrerWallet } from "@/lib/referrals/cookie";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";

const SLUG_RE = /^[a-z0-9-]{3,64}$/;
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{40,128}$/;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, { prefix: "referrals_record", max: 30, windowMs: 60_000 });
  if (limited) return limited;

  const session = await getWalletSession();
  if (!session) return bad("Wallet sign-in required.", 401);

  let body: { slug?: unknown; mintSignature?: unknown; referredWallet?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Invalid JSON.");
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const mintSignature = typeof body.mintSignature === "string" ? body.mintSignature : "";
  const referredWallet = typeof body.referredWallet === "string" ? body.referredWallet : "";

  if (!SLUG_RE.test(slug)) return bad("Bad slug.");
  if (!SIG_RE.test(mintSignature)) return bad("Bad signature.");
  if (referredWallet !== session.address) {
    return bad("referredWallet must match the signed-in session.", 403);
  }

  // Look up referrer cookie. If absent, this is just a no-op (no error,
  // because the mint is valid — the referral wasn't).
  const cookieStore = await cookies();
  const referrerWallet = sanitizeReferrerWallet(cookieStore.get(REFERRAL_COOKIE)?.value ?? null);
  if (!referrerWallet) {
    return NextResponse.json({ ok: true, recorded: false, reason: "no_referrer" });
  }
  if (referrerWallet === referredWallet) {
    // Self-referral. Quietly succeed without writing.
    return NextResponse.json({ ok: true, recorded: false, reason: "self_referral" });
  }

  const supabase = createServiceRoleClient();

  // Verify the launch exists + read mint price for revenue accounting.
  const { data: launch, error: launchErr } = await supabase
    .from("collections")
    .select("slug, mint_price_lamports")
    .eq("slug", slug)
    .maybeSingle();
  if (launchErr) return bad(launchErr.message, 500);
  if (!launch) return bad("Launch not found.", 404);

  const mintPriceLamports = (() => {
    try {
      return BigInt((launch as { mint_price_lamports: string | null }).mint_price_lamports ?? "0");
    } catch {
      return BigInt(0);
    }
  })();

  // Insert; ignore unique-conflict (idempotent).
  const { error: insertErr } = await supabase.from("referrals").insert({
    referrer_wallet: referrerWallet,
    referred_wallet: referredWallet,
    collection_slug: slug,
    mint_signature: mintSignature,
    mint_price_lamports: mintPriceLamports.toString(),
  });

  if (insertErr) {
    // Postgres unique-violation = 23505. Treat as success.
    const code = (insertErr as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ ok: true, recorded: false, reason: "already_recorded" });
    }
    return bad(insertErr.message, 500);
  }

  return NextResponse.json({ ok: true, recorded: true, referrer: referrerWallet });
}

enforceL2RouteModuleBoundary("src/app/api/referrals/record/route.ts", "L2:POST /api/referrals/record");
