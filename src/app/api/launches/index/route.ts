/**
 * @apiRouteLayer L2
 * GET /api/launches/index
 *
 * **Layer 2→3:** discovery over cached `collections` rows — UI only, not lifecycle authority.
 *
 * Public, unauthenticated discovery feed. Server-side sorting + filtering
 * for the launchpad home grid so we don't ship a 500-row dataset down the
 * wire to the client just to show 12.
 *
 * **Invariant:** This route does **not** filter or sort on `damm_pool` (no `IS NOT NULL` /
 * `NOT NULL` predicates). Cached DAMM addresses appear only on each card via `rowToCollection`
 * for client display. Lifecycle remains **Anchor `LaunchState` only** elsewhere.
 *
 * Supported query params:
 *   sort:     "trending" | "apr" | "fresh" | "filling" | "volume" | "price_asc" | "price_desc"
 *             | "supply_remaining" | "recent"
 *   status:   "all" | "live" | "upcoming" | "sold_out"  (default "all")
 *   category: free-text tag                        (optional)
 *   q:        case-insensitive substring match against name/symbol/tagline
 *   verified: "1" → only verified creators
 *   limit:    1..60                                (default 30)
 *   cursor:   opaque pagination token              (string id of last row)
 *
 * The response includes lightweight cards (the same fields CollectionCard
 * needs) plus discovery-only signals (`impliedAprPct`, `mintsLastHour`,
 * `holderCount`, `creatorVerified`).
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";


import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { rowToCollection, type CollectionRow } from "@/lib/supabase/map-collection";

export const dynamic = "force-dynamic";

const VALID_SORT = new Set([
  "trending",
  "apr",
  "fresh",
  "filling",
  "volume",
  "price_asc",
  "price_desc",
  "supply_remaining",
  "recent",
] as const);

type SortKey =
  | "trending"
  | "apr"
  | "fresh"
  | "filling"
  | "volume"
  | "price_asc"
  | "price_desc"
  | "supply_remaining"
  | "recent";

function parseSort(v: string | null): SortKey {
  // Legacy bookmark: was "DAMM-linked rows by 24h volume"; closest supported sort is global volume.
  if (v === "damm_volume") return "volume";
  if (v && (VALID_SORT as Set<string>).has(v)) return v as SortKey;
  return "trending";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sort = parseSort(url.searchParams.get("sort"));
  const status = (url.searchParams.get("status") ?? "all").toLowerCase();
  const category = url.searchParams.get("category");
  const q = (url.searchParams.get("q") ?? "").trim();
  const verifiedOnly = url.searchParams.get("verified") === "1";
  const limitRaw = Number(url.searchParams.get("limit") ?? 30);
  const limit = Math.max(1, Math.min(60, Number.isFinite(limitRaw) ? limitRaw : 30));

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("collections")
    .select("*")
    .eq("is_published", true)
    .limit(limit);

  if (status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (q) {
    // OR across name, symbol, tagline. PostgREST `or()` syntax.
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `name.ilike.%${escaped}%,token_symbol.ilike.%${escaped}%,tagline.ilike.%${escaped}%`,
    );
  }

  switch (sort) {
    case "apr":
      query = query.order("implied_apr_pct", { ascending: false });
      break;
    case "fresh":
      // Newest launches first; null launched_at goes to the bottom.
      query = query.order("launched_at", { ascending: false, nullsFirst: false });
      break;
    case "filling":
      query = query
        .order("mints_last_hour", { ascending: false })
        .order("volume_lamports_24h", { ascending: false, nullsFirst: false });
      break;
    case "supply_remaining":
      query = query
        .order("minted", { ascending: true })
        .order("supply", { ascending: false });
      break;
    case "recent":
      query = query.order("launched_at", { ascending: false, nullsFirst: false });
      break;
    case "volume":
      query = query.order("volume_lamports_24h", { ascending: false });
      break;
    case "price_asc":
      query = query.order("mint_price_lamports", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("mint_price_lamports", { ascending: false, nullsFirst: false });
      break;
    case "trending":
    default:
      query = query
        .order("trending_rank", { ascending: true, nullsFirst: false })
        .order("slug", { ascending: true });
      break;
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as CollectionRow[];
  const slugs = rows.map((r) => r.slug);

  // Storefront flag join — keeps the existing "Store live" badge accurate.
  const shopSlugs = new Set<string>();
  if (slugs.length > 0) {
    const { data: prod } = await supabase
      .from("products")
      .select("collection_slug")
      .eq("active", true)
      .in("collection_slug", slugs);
    for (const p of prod ?? []) shopSlugs.add(String((p as { collection_slug: string }).collection_slug));
  }

  // Verified-creator + display-name join. Single roundtrip for all
  // creator wallets that appear in this page of results.
  const creatorWallets = Array.from(
    new Set(
      rows
        .map((r) => r.creator_wallet)
        .filter((w): w is string => typeof w === "string" && w.length > 0),
    ),
  );

  const profileByWallet = new Map<string, { verified: boolean; display_name: string | null }>();
  if (creatorWallets.length > 0) {
    const { data: profiles } = await supabase
      .from("creator_profiles")
      .select("wallet, verified, display_name")
      .in("wallet", creatorWallets);
    for (const p of profiles ?? []) {
      const row = p as { wallet: string; verified: boolean; display_name: string | null };
      profileByWallet.set(row.wallet, { verified: row.verified, display_name: row.display_name });
    }
  }

  let cards = rows.map((row) => {
    const c = rowToCollection(row);
    const profile = row.creator_wallet ? profileByWallet.get(row.creator_wallet) : null;
    return {
      ...c,
      hasStorefront: shopSlugs.has(row.slug),
      creatorVerified: profile?.verified ?? false,
      creatorDisplayName: profile?.display_name ?? undefined,
    };
  });

  if (verifiedOnly) cards = cards.filter((c) => c.creatorVerified);

  return NextResponse.json({
    ok: true,
    sort,
    status,
    category,
    q,
    verifiedOnly,
    count: cards.length,
    cards,
  });
}

enforceL2RouteModuleBoundary("src/app/api/launches/index/route.ts", "L2:GET /api/launches/index");
