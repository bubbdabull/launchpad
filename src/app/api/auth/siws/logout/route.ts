/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { clearWalletSession } from "@/lib/auth/session";

export async function POST() {
  await clearWalletSession();
  return NextResponse.json({ ok: true });
}
