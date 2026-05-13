/**
 * @apiRouteLayer L3
 */

import { NextResponse, type NextRequest } from "next/server";

import { compositeGenesisPng } from "@/lib/nft-generation/compose/layers-png";
import { computeAssignmentForAsset, loadTraitConfigFromUrl } from "@/lib/nft-generation/config-loader";
import { genesisRevealPhase } from "@/lib/nft-generation/reveal/gate";
import { loadCollectionForMetadata } from "@/lib/metadata/load-collection";
import { inferRequestOrigin } from "@/lib/metadata/request-origin";
import { collectionMintFromHeliusAsset, getAsset } from "@/lib/solana/helius";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function unrevealedPlaceholderPng(origin: string, fallbackUrl?: string): Promise<Buffer> {
  if (fallbackUrl?.trim()) {
    const u = fallbackUrl.trim().startsWith("http")
      ? fallbackUrl.trim()
      : `${origin.replace(/\/$/, "")}${fallbackUrl.trim().startsWith("/") ? "" : "/"}${fallbackUrl.trim()}`;
    const res = await fetch(u);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  return sharp({
    create: { width: 800, height: 800, channels: 4, background: "#0b0f14" },
  })
    .png()
    .toBuffer();
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ message: "Invalid asset address." }, { status: 400 });
  }

  let asset;
  try {
    asset = await getAsset(address);
  } catch {
    return NextResponse.json({ message: "Could not load asset." }, { status: 503 });
  }

  const collectionMint = collectionMintFromHeliusAsset(asset);
  const chainAttrs = [
    ...(asset.plugins?.attributes?.data?.attribute_list?.map((a) => ({
      trait_type: a.key,
      value: a.value,
    })) ?? []),
  ];
  const slug = chainAttrs.find((a) => a.trait_type === "launch")?.value;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ message: "Asset missing launch slug." }, { status: 404 });
  }

  const c = await loadCollectionForMetadata(slug.trim());
  if (!c?.genesisPassNft) {
    return NextResponse.json({ message: "Generative Genesis Pass not configured for this launch." }, { status: 404 });
  }

  const g = c.genesisPassNft;
  const traitCfg = g.traitConfig ?? (g.traitConfigUri ? await loadTraitConfigFromUrl(g.traitConfigUri) : null);
  if (!traitCfg) {
    return NextResponse.json({ message: "Missing trait configuration." }, { status: 404 });
  }

  if (!collectionMint || collectionMint !== c.coreCollection) {
    return NextResponse.json({ message: "Collection binding mismatch." }, { status: 400 });
  }

  const origin = inferRequestOrigin(_req);
  const phase = genesisRevealPhase(Date.now(), g);

  if (phase === "unrevealed") {
    const buf = await unrevealedPlaceholderPng(origin, g.placeholderImageUrl);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }

  const assignment = computeAssignmentForAsset({
    config: traitCfg,
    launchSlug: c.slug,
    collectionMint,
    assetMint: address,
  });

  try {
    const png = await compositeGenesisPng({
      assignment,
      width: traitCfg.width,
      height: traitCfg.height,
      backgroundColor: traitCfg.backgroundColor,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Composite failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
