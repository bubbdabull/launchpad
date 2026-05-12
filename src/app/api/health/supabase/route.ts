/**
 * @apiRouteLayer L2
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";

import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Confirms env + cookie client can talk to Supabase Auth (no tables required). */
export async function GET() {
  const config = getSupabasePublicConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

enforceL2RouteModuleBoundary("src/app/api/health/supabase/route.ts", "L2:GET /api/health/supabase");
