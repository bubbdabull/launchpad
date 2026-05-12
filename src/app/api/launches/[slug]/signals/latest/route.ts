/**
 * @apiRouteLayer L2
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";

import { NextResponse } from "next/server";

import { TRENDING_SPEC_ID, TRENDING_SPEC_VERSION } from "@/lib/ecosystem/signals-methodology";
import { createServiceRoleClient } from "@/lib/supabase/server";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Latest stored signal snapshot for a launch (if workers have written one).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "Bad slug." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("launch_signal_snapshots")
      .select("spec_id, spec_version, computed_at, raw_inputs, derived_score, rank_hint")
      .eq("collection_slug", slug)
      .eq("spec_id", TRENDING_SPEC_ID)
      .eq("spec_version", TRENDING_SPEC_VERSION)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, methodology: "/api/ecosystem/signals-methodology" },
        { status: 503 },
      );
    }
    if (!data) {
      return NextResponse.json({
        ok: true,
        slug,
        snapshot: null,
        methodology: "/api/ecosystem/signals-methodology",
      });
    }
    return NextResponse.json({
      ok: true,
      slug,
      snapshot: data,
      methodology: "/api/ecosystem/signals-methodology",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Signals store unavailable (apply ecosystem-signals-and-indexer.sql).",
        methodology: "/api/ecosystem/signals-methodology",
      },
      { status: 503 },
    );
  }
}

enforceL2RouteModuleBoundary(
  "src/app/api/launches/[slug]/signals/latest/route.ts",
  "L2:GET /api/launches/[slug]/signals/latest",
);
