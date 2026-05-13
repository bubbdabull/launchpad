import path from "node:path";

import sharp from "sharp";

import type { GenesisTraitAssignment } from "@/lib/nft-generation/types";

function isHttp(u: string): boolean {
  return /^https?:\/\//i.test(u.trim());
}

async function loadLayerBuffer(file: string, layersBaseDir?: string): Promise<Buffer> {
  const trimmed = file.trim();
  if (isHttp(trimmed)) {
    const res = await fetch(trimmed);
    if (!res.ok) throw new Error(`Failed to fetch layer image: ${trimmed} (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const abs = layersBaseDir ? path.resolve(layersBaseDir, trimmed) : path.resolve(trimmed);
  const fs = await import("node:fs/promises");
  return fs.readFile(abs);
}

/**
 * Composite PNG layers in `assignment.picks` order (same order as layer `order` in config).
 */
export async function compositeGenesisPng(input: {
  assignment: GenesisTraitAssignment;
  width: number;
  height: number;
  backgroundColor?: string;
  /** Base directory for relative `file` paths in trait config. */
  layersBaseDir?: string;
}): Promise<Buffer> {
  const { width, height } = input;
  const bg = input.backgroundColor ?? "#0a0a12";
  const composites: { input: Buffer; blend: "over" }[] = [];

  for (const p of input.assignment.picks) {
    const buf = await loadLayerBuffer(p.file, input.layersBaseDir);
    const resized = await sharp(buf)
      .resize(width, height, { fit: "cover" })
      .ensureAlpha()
      .toBuffer();
    composites.push({ input: resized, blend: "over" });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bg,
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
