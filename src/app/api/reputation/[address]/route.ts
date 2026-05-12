/**
 * @apiRouteLayer L2
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";

import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { computeRepV1, type RepV1Inputs } from "@/lib/reputation/v1";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Public reputation tier for a wallet (slow signals). Uses `wallet_activity_rollups`
 * for inputs and `wallet_rep_v1_cache` only for hysteresis + persistence.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  try {
    new PublicKey(address);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid wallet address." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: cacheRow } = await supabase
      .from("wallet_rep_v1_cache")
      .select("tier")
      .eq("wallet", address)
      .maybeSingle();

    const { data: rollup, error: rollupError } = await supabase
      .from("wallet_activity_rollups")
      .select(
        "distinct_launches_minted, claim_event_count, distribution_recipient_count, sybil_cluster_hint",
      )
      .eq("wallet", address)
      .maybeSingle();

    if (rollupError) {
      const rel = rollupError.message.includes("does not exist");
      return NextResponse.json(
        { ok: false, error: rollupError.message, hint: rel ? "Apply supabase/reputation-v1.sql." : undefined },
        { status: rel ? 503 : 400 },
      );
    }

    const inputs: RepV1Inputs = {
      distinctLaunchesMinted: rollup?.distinct_launches_minted ?? 0,
      claimEventCount: rollup?.claim_event_count ?? 0,
      distributionRecipientCount: rollup?.distribution_recipient_count ?? 0,
      sybilClusterPenalty: rollup?.sybil_cluster_hint ? 0.25 : 0,
    };

    const result = computeRepV1(inputs, cacheRow?.tier ?? null);

    await supabase.from("wallet_rep_v1_cache").upsert(
      {
        wallet: address,
        tier: result.tier,
        raw_score: result.rawScore,
        methodology_version: result.methodologyVersion,
        inputs: result.inputs,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "wallet" },
    );

    return NextResponse.json({
      ok: true,
      wallet: address,
      tier: result.tier,
      rawScore: result.rawScore,
      methodologyVersion: result.methodologyVersion,
      inputs: result.inputs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: "Ensure Supabase service role env is set and reputation migrations are applied.",
      },
      { status: 503 },
    );
  }
}

enforceL2RouteModuleBoundary("src/app/api/reputation/[address]/route.ts", "L2:GET /api/reputation/[address]");
