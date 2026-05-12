/**
 * @apiRouteLayer L3
 */


import { NextResponse, type NextRequest } from "next/server";

import { buildTokenMetadataJson } from "@/lib/metadata/build-metadata";
import { loadCollectionForMetadata } from "@/lib/metadata/load-collection";
import { inferRequestOrigin } from "@/lib/metadata/request-origin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const c = await loadCollectionForMetadata(slug);
  if (!c) {
    return NextResponse.json({ message: "Launch not found." }, { status: 404 });
  }
  const origin = inferRequestOrigin(req);
  return NextResponse.json(buildTokenMetadataJson(c, origin), {
    headers: {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
