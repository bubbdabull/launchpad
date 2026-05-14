/**
 * @apiRouteLayer L3
 * Public leaderboard rows for generative Genesis Pass (Supabase + RLS).
 */

import { NextResponse, type NextRequest } from "next/server";

import { createPublicSupabaseClient } from "@/lib/supabase/public-read";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{3,64}$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await ctx.params;
  const slug = raw.toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ message: "Invalid slug." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ items: [], total: 0, message: "Supabase not configured." });
  }

  const { count, error: countErr } = await supabase
    .from("genesis_pass_rankings")
    .select("*", { count: "exact", head: true })
    .eq("collection_slug", slug);

  if (countErr) {
    return NextResponse.json({ message: countErr.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("genesis_pass_rankings")
    .select("rank, asset_mint, combo_id, summary_tier, rarity_score, picks, computed_at")
    .eq("collection_slug", slug)
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { items: data ?? [], total: count ?? 0, limit, offset },
    { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
