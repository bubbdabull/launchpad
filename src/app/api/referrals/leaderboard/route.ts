/**
 * @apiRouteLayer L2
 * GET /api/referrals/leaderboard
 *
 * Public, unauthenticated. Aggregates referral activity across the platform
 * so anyone can see the top referrers. Used by the /referrals page.
 *
 * Query params:
 *   - window: "7d" | "30d" | "all"   default "30d"
 *   - limit:  1..100                  default 25
 *
 * Returns rows of:
 *   { wallet, referralCount, mintVolumeLamports, distinctLaunches }
 *
 * We don't expose the inverse direction (who referred whom) — that data is
 * private and only surfaced on /api/referrals/me.
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";


import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  referrer_wallet: string;
  referred_wallet: string;
  collection_slug: string;
  mint_price_lamports: string | null;
  paid_out_lamports: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const windowParam = (url.searchParams.get("window") ?? "30d").toLowerCase();
  const limitRaw = Number(url.searchParams.get("limit") ?? 25);
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 25));

  const since = (() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (windowParam === "7d") return new Date(now - 7 * day).toISOString();
    if (windowParam === "30d") return new Date(now - 30 * day).toISOString();
    return null;
  })();

  const supabase = createServiceRoleClient();
  let q = supabase
    .from("referrals")
    .select("referrer_wallet, referred_wallet, collection_slug, mint_price_lamports, paid_out_lamports, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (since) q = q.gte("created_at", since);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  type Agg = {
    wallet: string;
    referralCount: number;
    mintVolumeLamports: bigint;
    paidOutLamports: bigint;
    distinctLaunches: Set<string>;
  };
  const byWallet = new Map<string, Agg>();
  for (const r of rows) {
    let agg = byWallet.get(r.referrer_wallet);
    if (!agg) {
      agg = {
        wallet: r.referrer_wallet,
        referralCount: 0,
        mintVolumeLamports: BigInt(0),
        paidOutLamports: BigInt(0),
        distinctLaunches: new Set(),
      };
      byWallet.set(r.referrer_wallet, agg);
    }
    agg.referralCount += 1;
    agg.distinctLaunches.add(r.collection_slug);
    try {
      agg.mintVolumeLamports += BigInt(r.mint_price_lamports ?? "0");
    } catch {
      /* ignore parse errors */
    }
    try {
      agg.paidOutLamports += BigInt(r.paid_out_lamports ?? "0");
    } catch {
      /* ignore parse errors */
    }
  }

  const leaderboard = Array.from(byWallet.values())
    .sort((a, b) => {
      // Primary: volume; tie-breaker: count.
      if (b.mintVolumeLamports !== a.mintVolumeLamports) {
        return b.mintVolumeLamports > a.mintVolumeLamports ? 1 : -1;
      }
      return b.referralCount - a.referralCount;
    })
    .slice(0, limit)
    .map((a) => ({
      wallet: a.wallet,
      referralCount: a.referralCount,
      distinctLaunches: a.distinctLaunches.size,
      mintVolumeLamports: a.mintVolumeLamports.toString(),
      paidOutLamports: a.paidOutLamports.toString(),
    }));

  return NextResponse.json({
    ok: true,
    window: windowParam,
    totalReferrers: byWallet.size,
    totalReferrals: rows.length,
    leaderboard,
  });
}

enforceL2RouteModuleBoundary("src/app/api/referrals/leaderboard/route.ts", "L2:GET /api/referrals/leaderboard");
