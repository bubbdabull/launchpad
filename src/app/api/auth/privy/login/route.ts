/**
 * @apiRouteLayer L3
 */


import { NextResponse, type NextRequest } from "next/server";

import { appendWalletSessionCookie } from "@/lib/auth/session";
import {
  PRIVY_SERVER_ENABLED,
  getPrivyClient,
  pickSolanaAddress,
  privyServerConfigMissing,
  verifyPrivyAccessToken,
} from "@/lib/auth/privy-server";
import { getPublicCluster } from "@/lib/solana/cluster-public";

export const dynamic = "force-dynamic";

/**
 * Exchange a Privy access token for our SIWS-shaped session cookie.
 *
 * When Privy is the sole login provider (production), the client posts
 * here right after `usePrivy().authenticated` flips true. We:
 *
 *   1. Verify the access token's signature + claims via Privy's JWKS
 *   2. Look up the Privy user (parsed from `privy-id-token` cookie when
 *      possible — no API call — falling back to `getUserById` only if
 *      the idToken doesn't carry the linked wallet)
 *   3. Pick the user's Solana wallet address (embedded or linked-external)
 *   4. Set our `lp_wallet_session` cookie keyed to that address
 *
 * After this, every existing call to `getWalletSession()` (admin, dashboard,
 * project-manage, server actions, etc.) keeps working unchanged — the
 * cookie shape is identical, only the writer changed.
 */
export async function POST(req: NextRequest) {
  if (!PRIVY_SERVER_ENABLED) {
    const missing = privyServerConfigMissing();
    return NextResponse.json(
      {
        error: `Privy server auth is not configured — missing ${missing}. Set it in your environment and redeploy/restart.`,
      },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  const headerToken = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : null;

  let bodyToken: string | null = null;
  try {
    const body = (await req.json().catch(() => null)) as
      | { token?: string }
      | null;
    bodyToken = body?.token ?? null;
  } catch {
    /* ignore */
  }

  const token = headerToken ?? bodyToken;
  if (!token) {
    return NextResponse.json(
      { error: "Missing Privy access token." },
      { status: 400 }
    );
  }

  const claims = await verifyPrivyAccessToken(token);
  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired Privy token." },
      { status: 401 }
    );
  }

  // Try the cheap cookie-based lookup first; fall back to API by userId
  // only if necessary (rate-limited, but acceptable for single-shot login).
  const client = getPrivyClient();
  if (!client) {
    const missing = privyServerConfigMissing();
    return NextResponse.json(
      {
        error: `Privy server auth is not configured — missing ${missing}.`,
      },
      { status: 503 }
    );
  }

  let user;
  try {
    user = await client.getUserById(claims.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not load Privy user." },
      { status: 502 }
    );
  }

  const address = pickSolanaAddress(user);
  if (!address) {
    return NextResponse.json(
      {
        error:
          "Your Privy account doesn’t have a Solana wallet yet. Reload and try signing in again.",
      },
      { status: 409 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    address,
    privyUserId: claims.userId,
  });
  appendWalletSessionCookie(res, address, getPublicCluster());
  return res;
}

export function GET() {
  return NextResponse.json(
    { error: "Use POST with a Bearer Privy access token." },
    { status: 405 }
  );
}
