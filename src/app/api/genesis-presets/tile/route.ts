/**
 * @apiRouteLayer L3
 * Small PNG tiles for built-in Genesis trait presets (no external assets).
 */

import { NextResponse, type NextRequest } from "next/server";

import sharp from "sharp";

import { isGenesisBuiltinTraitPresetId } from "@/lib/nft-generation/presets/built-in-genesis-presets";
import { buildGenesisPresetTileSvg } from "@/lib/nft-generation/presets/genesis-preset-tile-art";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const presetRaw = searchParams.get("p") ?? "";
  const preset = presetRaw.toLowerCase();
  if (!isGenesisBuiltinTraitPresetId(preset)) {
    return NextResponse.json({ message: "Unknown preset." }, { status: 400 });
  }
  const layerRaw = searchParams.get("l");
  const indexRaw = searchParams.get("i");
  const layer = Number(layerRaw);
  const index = Number(indexRaw);
  if (!Number.isInteger(layer) || layer < 0 || layer > 2 || !Number.isInteger(index) || index < 0 || index > 2) {
    return NextResponse.json({ message: "Invalid layer or index." }, { status: 400 });
  }

  const svg = buildGenesisPresetTileSvg(preset, layer, index);
  const buf = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
