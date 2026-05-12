/**
 * @apiRouteLayer L2
 * GET /api/launches/[slug]/yield
 *
 * **Layer 2→3 only:** aggregates rows in `fee_distributions` + listing fields for
 * display (APR estimate). Not entitlement or on-chain claim logic — clients must
 * still read program state for actual claimable balances.
 *
 * Public, unauthenticated. Returns aggregate Pass-yield stats for a launch
 * so the holder UI can answer the question "is holding this Pass paying?":
 *
 *   - lifetimeHolderShareLamports — every lamport ever distributed to
 *     Pass holders for this collection
 *   - last30dHolderShareLamports  — last 30 days of distributions only
 *   - last7dHolderShareLamports   — last 7 days of distributions only
 *   - perPassLifetimeLamports     — lifetime / current pass count
 *   - perPass7dLamports           — last-7d / current pass count
 *   - apr                          — annualized yield % implied by the 7-day rate
 *                                    (= per-pass-7d × (365/7) ÷ mint price)
 *
 * Numbers are intentionally aggregate — no per-wallet info — so the route
 * is safe to expose publicly. The mint flow uses this to show "estimated
 * APR" before someone commits SOL, which is the single biggest behavioral
 * lever for "hold the Pass" vs "flip immediately."
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";


import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";

const SLUG_RE = /^[a-z0-9-]{3,64}$/;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

type CollectionRow = {
  slug: string;
  supply: number | null;
  minted: number | null;
  mint_price_lamports: string | null;
  core_collection: string | null;
};

type DistributionRow = {
  kind: string;
  holder_share_lamports: string | null;
  created_at: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) return bad("Bad slug.");

  const supabase = createServiceRoleClient();
  const { data: launch, error: launchErr } = await supabase
    .from("collections")
    .select("slug, supply, minted, mint_price_lamports, core_collection")
    .eq("slug", slug)
    .maybeSingle();

  if (launchErr) return bad(launchErr.message, 500);
  if (!launch) return bad("Launch not found.", 404);
  const c = launch as CollectionRow;

  const passCount = Math.max(1, c.minted ?? c.supply ?? 0);
  const mintPriceLamports = (() => {
    if (!c.mint_price_lamports) return BigInt(0);
    try {
      return BigInt(c.mint_price_lamports);
    } catch {
      return BigInt(0);
    }
  })();

  // Pull every "creator" distribution for this collection. We exclude
  // "platform" rows because those go to the platform treasury, not holders.
  // "token-reward" rows are SPL tokens, not lamports — the route would
  // need decimal/price context to value them; v1 reports them separately
  // as a count of distributions but doesn't try to convert to SOL.
  const { data: dists, error: distErr } = await supabase
    .from("fee_distributions")
    .select("kind, holder_share_lamports, created_at")
    .eq("collection_slug", slug)
    .order("created_at", { ascending: false })
    .limit(500);

  if (distErr) return bad(distErr.message, 500);
  const rows = (dists ?? []) as DistributionRow[];

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  let lifetime = BigInt(0);
  let last30d = BigInt(0);
  let last7d = BigInt(0);
  let tokenRewardCount = 0;

  for (const r of rows) {
    if (r.kind === "token-reward") {
      tokenRewardCount += 1;
      continue;
    }
    if (r.kind !== "creator") continue;
    let v: bigint;
    try {
      v = BigInt(r.holder_share_lamports ?? "0");
    } catch {
      continue;
    }
    if (v <= BigInt(0)) continue;

    lifetime += v;
    const ageMs = now - Date.parse(r.created_at);
    if (ageMs <= 30 * day) last30d += v;
    if (ageMs <= 7 * day) last7d += v;
  }

  const perPassLifetime = lifetime / BigInt(passCount);
  const perPass7d = last7d / BigInt(passCount);

  // APR: (per-pass 7d earnings × (365/7)) ÷ mint price ⇒ annualized % yield.
  // Approximate; assumes the next year averages the last 7 days, which is
  // an overestimate during the post-launch volume spike. Frontend shows
  // this as "implied 7d APR" with the caveat in copy.
  let apr7d = 0;
  if (mintPriceLamports > BigInt(0) && perPass7d > BigInt(0)) {
    const perPassSol = Number(perPass7d) / 1_000_000_000;
    const mintPriceSol = Number(mintPriceLamports) / 1_000_000_000;
    apr7d = (perPassSol * (365 / 7) * 100) / mintPriceSol;
  }

  return NextResponse.json({
    ok: true,
    slug: c.slug,
    passCount,
    mintPriceLamports: mintPriceLamports.toString(),
    distributionCount: rows.filter((r) => r.kind === "creator").length,
    tokenRewardDistributionCount: tokenRewardCount,
    lifetime: {
      holderShareLamports: lifetime.toString(),
      perPassLamports: perPassLifetime.toString(),
    },
    last30d: {
      holderShareLamports: last30d.toString(),
    },
    last7d: {
      holderShareLamports: last7d.toString(),
      perPassLamports: perPass7d.toString(),
    },
    apr: {
      // Implied annualized yield from the 7-day window. Returned as a Number
      // (not bigint) since it's an estimation, not lamport accounting.
      sevenDayPct: apr7d,
    },
  });
}

enforceL2RouteModuleBoundary(
  "src/app/api/launches/[slug]/yield/route.ts",
  "L2:GET /api/launches/[slug]/yield",
);
