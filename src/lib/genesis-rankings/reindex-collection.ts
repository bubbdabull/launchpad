import "server-only";

import {
  computeAssignmentForAsset,
  loadTraitConfigFromUrl,
} from "@/lib/nft-generation/config-loader";
import { naiveRarityScoreFromAssignment } from "@/lib/nft-generation/rarity/naive-rarity-score";
import type { TraitCollectionConfig } from "@/lib/nft-generation/types";
import { getAssetsByCollection } from "@/lib/solana/helius";
import { rowToCollection, type CollectionRow } from "@/lib/supabase/map-collection";
import { createServiceRoleClient } from "@/lib/supabase/server";

const PAGE_SIZE = 100;
const MAX_PAGES = 200;

type RankRow = {
  collection_slug: string;
  asset_mint: string;
  combo_id: string;
  summary_tier: string;
  rarity_score: number;
  rank: number;
  picks: unknown;
  computed_at: string;
};

type StagedRow = Omit<RankRow, "rank" | "computed_at">;

async function resolveTraitConfigForRow(row: CollectionRow): Promise<TraitCollectionConfig | null> {
  const c = rowToCollection(row);
  const g = c.genesisPassNft;
  if (!g) return null;
  if (g.traitConfig?.schemaVersion === 1) return g.traitConfig;
  const uri = g.traitConfigUri?.trim();
  if (!uri) return null;
  return loadTraitConfigFromUrl(uri);
}

/**
 * Pull all Core assets under `coreCollection`, compute generative assignments,
 * score, rank, and upsert into `genesis_pass_rankings`.
 */
export async function reindexGenesisPassRankingsForSlug(slug: string): Promise<
  | { ok: true; indexed: number; pages: number }
  | { ok: false; message: string }
> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase.from("collections").select("*").eq("slug", slug).maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Launch not found." };

  const collection = rowToCollection(row as CollectionRow);
  const core = collection.coreCollection?.trim();
  if (!core) return { ok: false, message: "Core collection mint is not set yet." };

  let traitCfg: TraitCollectionConfig | null = null;
  try {
    traitCfg = await resolveTraitConfigForRow(row as CollectionRow);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load trait config.";
    return { ok: false, message: msg };
  }
  if (!traitCfg) return { ok: false, message: "No trait config (inline or hosted URI) on this launch." };

  const staged: StagedRow[] = [];
  let pages = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: { items: Array<{ id: string }>; total?: number };
    try {
      res = await getAssetsByCollection(core, { page, limit: PAGE_SIZE });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Helius request failed.";
      return { ok: false, message: msg };
    }
    pages = page;
    const items = res.items ?? [];
    if (items.length === 0) break;

    for (const asset of items) {
      const assetMint = asset.id?.trim();
      if (!assetMint) continue;
      try {
        const assignment = computeAssignmentForAsset({
          config: traitCfg,
          launchSlug: slug,
          collectionMint: core,
          assetMint,
        });
        const rarity_score = naiveRarityScoreFromAssignment(traitCfg, assignment);
        staged.push({
          collection_slug: slug,
          asset_mint: assetMint,
          combo_id: assignment.comboId,
          summary_tier: assignment.summaryTier,
          rarity_score,
          picks: assignment.picks,
        });
      } catch {
        /* skip assets that fail assignment (wrong collection, etc.) */
      }
    }

    if (items.length < PAGE_SIZE) break;
  }

  staged.sort((a, b) => {
    if (b.rarity_score !== a.rarity_score) return b.rarity_score - a.rarity_score;
    return a.combo_id.localeCompare(b.combo_id);
  });

  const rows: RankRow[] = staged.map((r, i) => ({
    ...r,
    rank: i + 1,
    computed_at: new Date().toISOString(),
  }));

  const CHUNK = 250;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: upErr } = await supabase.from("genesis_pass_rankings").upsert(slice, {
      onConflict: "collection_slug,asset_mint",
    });
    if (upErr) return { ok: false, message: upErr.message };
  }

  return { ok: true, indexed: rows.length, pages };
}
