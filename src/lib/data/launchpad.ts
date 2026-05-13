import {
  collections as fallbackCollections,
  getCollection as getStaticCollection,
  getFeatured as getStaticFeatured,
  platformStats as fallbackPlatformStats,
} from "@/data/collections";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { rowToCollection, type CollectionRow } from "@/lib/supabase/map-collection";
import type { Collection } from "@/types/collection";
import type { PlatformStats } from "@/types/platform";

function computePlatformStats(collections: Collection[]): PlatformStats {
  const live = collections.filter((c) => c.status === "live");
  return {
    launchesLive: live.length,
    totalMinted: collections.reduce((s, c) => s + c.minted, 0),
    totalSupply: collections.reduce((s, c) => s + c.supply, 0),
    totalLaunches: collections.length,
  };
}

function pickFeatured(rows: CollectionRow[], mapped: Collection[]): Collection {
  const featuredRow = rows.find((r) => r.is_featured);
  if (featuredRow) {
    const hit = mapped.find((c) => c.slug === featuredRow.slug);
    if (hit) return hit;
  }
  return mapped[0] ?? { ...getStaticFeatured() };
}

function fallbackPageData(): LaunchpadPageData {
  return {
    collections: fallbackCollections.map((c) => ({ ...c })),
    featured: { ...getStaticFeatured() },
    platformStats: fallbackPlatformStats,
  };
}

export type LaunchpadPageData = {
  collections: Collection[];
  featured: Collection;
  platformStats: PlatformStats;
};

export async function getLaunchpadPageData(): Promise<LaunchpadPageData> {
  if (!getSupabasePublicConfig()) {
    return fallbackPageData();
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("is_published", true)
      .order("trending_rank", { ascending: true, nullsFirst: false })
      .order("slug", { ascending: true });

    if (error || !data?.length) {
      return fallbackPageData();
    }

    const rows = data as CollectionRow[];
    const mapped = rows.map((row) => rowToCollection(row));
    return {
      collections: mapped,
      featured: pickFeatured(rows, mapped),
      platformStats: computePlatformStats(mapped),
    };
  } catch {
    return fallbackPageData();
  }
}

/** Single collection for mint/launch pages; falls back to static sample data. */
export async function getCollectionBySlug(slug: string): Promise<Collection | undefined> {
  if (!getSupabasePublicConfig()) {
    return getStaticCollection(slug);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!error && data) {
      return rowToCollection(data as CollectionRow);
    }
  } catch {
    /* fall through */
  }

  return getStaticCollection(slug);
}
