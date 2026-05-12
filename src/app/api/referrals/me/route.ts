/**
 * @apiRouteLayer L2
 * GET /api/referrals/me
 *
 * Authenticated (SIWS wallet session). Returns the signed-in wallet's
 * referral history — everyone they brought in, plus aggregate stats, plus
 * payout state. Drives the personal "Your referrals" section on /referrals.
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";


import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  referred_wallet: string;
  collection_slug: string;
  mint_signature: string | null;
  mint_price_lamports: string | null;
  paid_out_lamports: string | null;
  paid_out_signature: string | null;
  created_at: string;
};

export async function GET() {
  const session = await getWalletSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Wallet sign-in required." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("referred_wallet, collection_slug, mint_signature, mint_price_lamports, paid_out_lamports, paid_out_signature, created_at")
    .eq("referrer_wallet", session.address)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  let totalVolume = BigInt(0);
  let totalPaid = BigInt(0);
  for (const r of rows) {
    try {
      totalVolume += BigInt(r.mint_price_lamports ?? "0");
    } catch {
      /* ignore */
    }
    try {
      totalPaid += BigInt(r.paid_out_lamports ?? "0");
    } catch {
      /* ignore */
    }
  }

  const distinctReferred = new Set(rows.map((r) => r.referred_wallet)).size;
  const distinctLaunches = new Set(rows.map((r) => r.collection_slug)).size;

  return NextResponse.json({
    ok: true,
    wallet: session.address,
    totalCount: rows.length,
    distinctReferred,
    distinctLaunches,
    totalVolumeLamports: totalVolume.toString(),
    totalPaidLamports: totalPaid.toString(),
    referrals: rows.map((r) => ({
      referredWallet: r.referred_wallet,
      collectionSlug: r.collection_slug,
      mintSignature: r.mint_signature,
      mintPriceLamports: r.mint_price_lamports ?? "0",
      paidOutLamports: r.paid_out_lamports ?? "0",
      paidOutSignature: r.paid_out_signature,
      createdAt: r.created_at,
    })),
  });
}

enforceL2RouteModuleBoundary("src/app/api/referrals/me/route.ts", "L2:GET /api/referrals/me");
