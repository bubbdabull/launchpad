/**
 * @apiRouteLayer L3
 */

import { NextResponse, type NextRequest } from "next/server";

import { createPublicSupabaseClient } from "@/lib/supabase/public-read";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{3,64}$/;

/**
 * Read-only hint for the next Genesis Pass edition number (off-chain `collections.minted` mirror).
 * **Not authoritative** for allocation or MintReceipt — FCFS races can still reorder; use for UX + on-chain attrs only.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await ctx.params;
  const slug = raw.toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ message: "Invalid slug." }, { status: 400 });
  }

  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase not configured — use client collection minted count.", source: "none" as const },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("collections")
    .select("minted, supply")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ message: "Launch not found." }, { status: 404 });
  }

  const minted = Math.max(0, Math.round(Number((data as { minted: number }).minted)));
  const supply = Math.max(0, Math.round(Number((data as { supply: number }).supply)));
  const nextMintOrder = minted + 1;

  return NextResponse.json(
    {
      slug,
      minted,
      supply,
      nextMintOrder,
      soldOut: supply > 0 && minted >= supply,
      source: "supabase_public" as const,
    },
    { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=15" } },
  );
}
