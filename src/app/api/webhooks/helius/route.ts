/**
 * @apiRouteLayer L2
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";

import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Helius webhook handler.
 *
 * Configure in Helius dashboard → Webhooks → New webhook:
 *   - Webhook URL:    https://your-domain.com/api/webhooks/helius
 *   - Auth header:    Authorization: Bearer <HELIUS_WEBHOOK_AUTH from .env.local>
 *   - Type:           Enhanced
 *   - Account addrs:  Alpha Vault, DAMM pool, token mint, and/or Core collection
 *     pubkeys you want to track for each launch
 *
 * On each push we bump `updated_at` on any `collections` row whose cached
 * on-chain wiring overlaps the touched accounts so downstream jobs can
 * refresh volume, graduation flags, etc. Idempotent — Helius retries until 2xx.
 */

type HeliusEnhancedTx = {
  signature: string;
  type?: string;
  source?: string;
  accountData?: Array<{ account: string }>;
  events?: Record<string, unknown>;
  description?: string;
};

export async function POST(req: Request) {
  const expectedAuth = process.env.HELIUS_WEBHOOK_AUTH?.trim();
  if (expectedAuth) {
    const got = req.headers.get("authorization") ?? "";
    if (got !== `Bearer ${expectedAuth}` && got !== expectedAuth) {
      return NextResponse.json({ ok: false, error: "Bad auth" }, { status: 401 });
    }
  }

  let body: HeliusEnhancedTx[] = [];
  try {
    const parsed = (await req.json()) as unknown;
    body = Array.isArray(parsed) ? (parsed as HeliusEnhancedTx[]) : [];
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const touched = new Set<string>();
  for (const tx of body) {
    for (const a of tx.accountData ?? []) touched.add(a.account);
  }
  if (touched.size === 0) return NextResponse.json({ ok: true, processed: body.length });

  const addrs = Array.from(touched);
  const stamp = new Date().toISOString();

  try {
    const supabase = createServiceRoleClient();
    // Touch rows when infra pubkeys appear in logs — invalidation only, not lifecycle transitions.
    const bump = async (column: "alpha_vault" | "damm_pool" | "token_mint" | "core_collection") => {
      await supabase.from("collections").update({ updated_at: stamp }).in(column, addrs);
    };
    await bump("alpha_vault");
    await bump("damm_pool");
    await bump("token_mint");
    await bump("core_collection");
  } catch {
    // Don't fail the webhook on DB errors; Helius will retry and we don't
    // want to spam its retry queue.
  }

  return NextResponse.json({ ok: true, processed: body.length, touched: touched.size });
}

/** Helius pings GET on creation to verify the URL is reachable. */
export async function GET() {
  return NextResponse.json({ ok: true, route: "helius-webhook" });
}

enforceL2RouteModuleBoundary("src/app/api/webhooks/helius/route.ts", "L2:/api/webhooks/helius");
