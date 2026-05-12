/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

/**
 * Token holder reward **planning** and POST audit were removed.
 * SPL splits must be enforced on-chain; this route does not compute allocations.
 */

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "gone",
      message:
        "Server-side token holder snapshots and payout batches are disabled. Use on-chain claim / stream instructions only.",
    },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "gone",
      message:
        "Server-side token distribution audit is disabled. Persist only decoded on-chain events via your indexer if needed.",
    },
    { status: 410 },
  );
}
