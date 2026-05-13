/**
 * @apiRouteLayer L3
 */

import { NextResponse, type NextRequest } from "next/server";

import { computeAssignmentForAsset, loadTraitConfigFromUrl } from "@/lib/nft-generation/config-loader";
import { genesisRevealPhase, parseRevealAtMs } from "@/lib/nft-generation/reveal/gate";
import { loadCollectionForMetadata } from "@/lib/metadata/load-collection";
import { collectionMintFromHeliusAsset, getAsset } from "@/lib/solana/helius";

export const dynamic = "force-dynamic";

const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("asset")?.trim() ?? "";
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ message: "Query ?asset=<pubkey> required." }, { status: 400 });
  }

  let asset;
  try {
    asset = await getAsset(address);
  } catch {
    return NextResponse.json({ message: "Could not load asset." }, { status: 503 });
  }

  const attrs = [
    ...(asset.plugins?.attributes?.data?.attribute_list?.map((a) => ({
      trait_type: a.key,
      value: a.value,
    })) ?? []),
  ];
  const slug = attrs.find((a) => a.trait_type === "launch")?.value;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ message: "Asset missing launch slug." }, { status: 404 });
  }

  const c = await loadCollectionForMetadata(slug.trim());
  const g = c?.genesisPassNft;
  if (!g) {
    return NextResponse.json({ message: "No genesis pass config." }, { status: 404 });
  }

  const collectionMint = collectionMintFromHeliusAsset(asset);
  const bound =
    !!collectionMint && !!c.coreCollection && collectionMint === c.coreCollection.trim();

  const phase = genesisRevealPhase(Date.now(), g);
  const revealAtMs = parseRevealAtMs(g);

  let summaryTier: string | undefined;
  let comboId: string | undefined;
  if (phase === "revealed" && bound) {
    const traitCfg = g.traitConfig ?? (g.traitConfigUri ? await loadTraitConfigFromUrl(g.traitConfigUri) : null);
    if (traitCfg) {
      const a = computeAssignmentForAsset({
        config: traitCfg,
        launchSlug: c.slug,
        collectionMint: c.coreCollection!.trim(),
        assetMint: address,
      });
      summaryTier = a.summaryTier;
      comboId = a.comboId;
    }
  }

  return NextResponse.json({
    asset: address,
    slug: c.slug,
    phase,
    revealAtMs: revealAtMs ?? null,
    collectionBound: bound,
    summaryTier: summaryTier ?? null,
    comboId: comboId ?? null,
    cosmeticOnly: true,
  });
}
