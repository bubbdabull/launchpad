/**
 * @apiRouteLayer L2
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";

import { NextResponse } from "next/server";

import { SIGNAL_METHODOLOGY, TRENDING_SPEC_ID, TRENDING_SPEC_VERSION } from "@/lib/ecosystem/signals-methodology";

/**
 * Public, cacheable methodology for trending / discovery signals.
 * Workers should stamp `spec_id` + `version` on every `launch_signal_snapshots` row.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      current: {
        specId: TRENDING_SPEC_ID,
        version: TRENDING_SPEC_VERSION,
      },
      methodology: SIGNAL_METHODOLOGY,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}

enforceL2RouteModuleBoundary(
  "src/app/api/ecosystem/signals-methodology/route.ts",
  "L2:GET /api/ecosystem/signals-methodology",
);
