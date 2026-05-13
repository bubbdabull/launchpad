/**
 * @apiRouteLayer L3
 */


import { NextResponse, type NextRequest } from "next/server";

import { buildAssetMetadataJson } from "@/lib/metadata/build-metadata";
import { mergeGenerativeGenesisIntoAssetMetadata } from "@/lib/metadata/genesis-generative";
import { loadCollectionForMetadata } from "@/lib/metadata/load-collection";
import { inferRequestOrigin } from "@/lib/metadata/request-origin";
import { getAsset, getAssetAttributes } from "@/lib/solana/helius";

export const dynamic = "force-dynamic";

const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ message: "Invalid asset address." }, { status: 400 });
  }

  let slug: string | undefined;
  let assetName = `Genesis Pass`;
  let chainAttributes: Array<{ trait_type?: string; value?: string }> = [];
  try {
    const asset = await getAsset(address);
    chainAttributes = getAssetAttributes(asset);
    slug = chainAttributes.find((a) => a.trait_type === "launch")?.value;
    const nm = asset.content?.metadata?.name;
    if (typeof nm === "string" && nm.trim()) assetName = nm.trim();
  } catch {
    return NextResponse.json(
      { message: "Could not load on-chain asset (check HELIUS_API_KEY)." },
      { status: 503 },
    );
  }

  if (!slug) {
    return NextResponse.json(
      { message: "Asset has no launch slug in on-chain attributes yet." },
      { status: 404 },
    );
  }

  const collection = await loadCollectionForMetadata(slug);
  if (!collection) {
    return NextResponse.json({ message: "Launch not found for this asset." }, { status: 404 });
  }

  const origin = inferRequestOrigin(req);

  const base = buildAssetMetadataJson({
    collection,
    origin,
    assetName,
    chainAttributes,
  });

  const body = await mergeGenerativeGenesisIntoAssetMetadata({
    base,
    collection,
    origin,
    assetAddress: address,
    chainAttributes,
  });

  return NextResponse.json(body, {
      headers: {
        "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
