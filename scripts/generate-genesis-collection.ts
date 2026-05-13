/**
 * Batch-generate Genesis Pass images + Metaplex-style metadata JSON + trait manifest.
 *
 * Usage (your own layers on disk):
 *   npx tsx scripts/generate-genesis-collection.ts --config ./my-trait-config.json --out ./generated --count 100 --launch-seed my-launch-v1 --layers-dir ./my-layer-pngs
 *
 * Quick demo (HTTPS layers, no --layers-dir; needs network for picsum.photos):
 *   npm run generate:genesis:demo
 *   npm run generate:genesis:demo -- --pinata   # reads PINATA_JWT from .env.local (repo root)
 *
 * Outputs:
 *   <out>/images/<index>.png
 *   <out>/metadata/<index>.json
 *   <out>/manifest.json
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { compositeGenesisPng } from "../src/lib/nft-generation/compose/layers-png";
import {
  assertTraitCollectionConfig,
  batchSeedBytes,
  loadTraitConfigFromJsonText,
} from "../src/lib/nft-generation/config-loader";
import { resolveGenesisTraits } from "../src/lib/nft-generation/traits/resolve";
import { assignmentToMetaplexAttributes } from "../src/lib/nft-generation/metadata/metaplex-traits";
import type { TraitManifestEntry } from "../src/lib/nft-generation/types";

/**
 * `tsx` does not load `.env.local` (Next.js does). Merge `.env` then `.env.local`
 * into `process.env` so `PINATA_JWT` works with `--pinata`.
 * Run from repo root (`npm run generate:genesis:demo`); shell-exported vars are not overwritten.
 */
async function loadRepoEnvFiles(): Promise<void> {
  const root = process.cwd();
  const merged: Record<string, string> = {};
  for (const name of [".env", ".env.local"] as const) {
    const p = path.join(root, name);
    try {
      const text = await fs.readFile(p, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        merged[key] = val;
      }
    } catch {
      /* optional files */
    }
  }
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

function requireArg(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  await loadRepoEnvFiles();

  const configPath = requireArg("--config");
  const outDir = requireArg("--out");
  const count = Math.max(1, Math.min(50_000, parseInt(requireArg("--count"), 10) || 0));
  const launchSeed = requireArg("--launch-seed");
  const layersDir = arg("--layers-dir") ?? process.cwd();
  const namePrefix = arg("--name-prefix") ?? "Genesis Pass";

  const rawText = await fs.readFile(configPath, "utf8").catch((err: NodeJS.ErrnoException) => {
    if (err?.code === "ENOENT") {
      throw new Error(
        `Config file not found: ${configPath}\n` +
          `  Use a real path, or run the built-in demo (no local PNG folders):\n` +
          `    npm run generate:genesis:demo\n` +
          `  Or copy the schema example and point --layers-dir at your PNGs:\n` +
          `    src/lib/nft-generation/schema/trait-config.example.json`,
      );
    }
    throw err;
  });
  const config = loadTraitConfigFromJsonText(rawText);
  assertTraitCollectionConfig(config);

  const imgDir = path.join(outDir, "images");
  const metaDir = path.join(outDir, "metadata");
  await fs.mkdir(imgDir, { recursive: true });
  await fs.mkdir(metaDir, { recursive: true });

  const manifest: TraitManifestEntry[] = [];
  const seen = new Set<string>();

  for (let mintIndex = 1; mintIndex <= count; mintIndex++) {
    const seed = batchSeedBytes(launchSeed, mintIndex);
    const assignment = resolveGenesisTraits(config, seed);
    if (seen.has(assignment.comboId)) {
      throw new Error(`Duplicate combo at mintIndex=${mintIndex} (${assignment.comboId}) — adjust weights or incompatibilities.`);
    }
    seen.add(assignment.comboId);

    const png = await compositeGenesisPng({
      assignment,
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      layersBaseDir: layersDir,
    });

    const imgRel = `images/${mintIndex}.png`;
    await fs.writeFile(path.join(outDir, imgRel), png);

    const attributes = assignmentToMetaplexAttributes(assignment);
    const meta = {
      name: `${namePrefix} #${mintIndex}`,
      symbol: "PASS",
      description: "Generative Genesis Pass (pre-reveal batch). Pin to Arweave/IPFS for production.",
      image: imgRel,
      attributes,
      properties: {
        category: "image",
        files: [{ uri: imgRel, type: "image/png" }],
      },
    };

    await fs.writeFile(path.join(metaDir, `${mintIndex}.json`), JSON.stringify(meta, null, 2));
    manifest.push({ mintIndex, comboId: assignment.comboId, picks: assignment.picks, summaryTier: assignment.summaryTier });
  }

  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console -- CLI script
  console.log(`Wrote ${count} assets to ${outDir}`);

  if (process.argv.includes("--pinata")) {
    const { createPinataGenesisUploaderFromEnv } = await import(
      "../src/lib/nft-generation/storage/pinata-genesis-uploader"
    );
    const uploader = createPinataGenesisUploaderFromEnv();
    const pinned = await uploader.uploadJson("genesis-manifest.json", manifest);
    // eslint-disable-next-line no-console -- CLI script
    console.log("Pinned manifest (IPFS):", pinned.uri);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console -- CLI script
  console.error(e);
  process.exit(1);
});
