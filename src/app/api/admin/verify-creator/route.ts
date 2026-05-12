/**
 * @apiRouteLayer L3
 * POST /api/admin/verify-creator
 *
 * Toggles the `verified` flag on a creator_profiles row. Restricted to the
 * platform admin wallets configured in PLATFORM_ADMIN_WALLETS (comma-separated,
 * server-side env). The route checks the SIWS session, not the wallet sender,
 * so the admin must be signed in.
 *
 * Body:
 *   { wallet: "<base58>", verified: boolean }
 *
 * On verify=true we also stamp verified_at + verified_by so the audit trail
 * is preserved. On verify=false we clear those fields.
 */

import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { refreshCreatorCounters } from "@/lib/creators/profiles";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function adminWallets(): Set<string> {
  const raw = (process.env.PLATFORM_ADMIN_WALLETS ?? "").trim();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => BASE58_RE.test(s)),
  );
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, { prefix: "admin_verify", max: 30, windowMs: 60_000 });
  if (limited) return limited;

  const session = await getWalletSession();
  if (!session) return bad("Wallet sign-in required.", 401);
  const admins = adminWallets();
  if (!admins.has(session.address)) {
    return bad("Not authorized.", 403);
  }

  let body: { wallet?: unknown; verified?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Invalid JSON.");
  }
  const wallet = typeof body.wallet === "string" ? body.wallet : "";
  const verified = !!body.verified;
  if (!BASE58_RE.test(wallet)) return bad("Bad wallet.");

  const supabase = createServiceRoleClient();
  const update: {
    wallet: string;
    verified: boolean;
    verified_at: string | null;
    verified_by: string | null;
  } = verified
    ? {
        wallet,
        verified: true,
        verified_at: new Date().toISOString(),
        verified_by: session.address,
      }
    : {
        wallet,
        verified: false,
        verified_at: null,
        verified_by: null,
      };
  const { error } = await supabase
    .from("creator_profiles")
    .upsert(update, { onConflict: "wallet" });
  if (error) return bad(error.message, 500);

  // Refresh denormalized counters in the same call so the admin UI reflects
  // up-to-date launch_count / total_holders_estimate.
  const profile = await refreshCreatorCounters(wallet);
  return NextResponse.json({ ok: true, profile });
}
