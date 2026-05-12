/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

// Deprecated EVM Sign-In With Ethereum endpoint. The platform is Solana-only
// and uses Sign-In With Solana (SIWS) at /api/auth/siws/*. This route is kept
// as a 410 Gone tombstone so any cached clients fail loudly without breaking
// the build.

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    { error: "SIWE is removed. Use /api/auth/siws/verify instead." },
    { status: 410 }
  );
}

export function POST() {
  return NextResponse.json(
    { error: "SIWE is removed. Use /api/auth/siws/verify instead." },
    { status: 410 }
  );
}
