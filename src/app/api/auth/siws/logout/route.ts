/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { appendClearWalletSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  appendClearWalletSessionCookie(res);
  return res;
}
