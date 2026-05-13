/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { appendClearWalletSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Clear our `lp_wallet_session` cookie. Pair this with a client-side call
 * to `usePrivy().logout()` so Privy's own cookies (`privy-token`,
 * `privy-id-token`, `privy-refresh-token`) are also cleared. Calling
 * either side alone leaves the user in a half-logged-out state.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  appendClearWalletSessionCookie(res);
  return res;
}
