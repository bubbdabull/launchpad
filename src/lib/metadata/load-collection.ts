import { getCollection } from "@/data/collections";
import { rowToCollection, type CollectionRow } from "@/lib/supabase/map-collection";
import { createPublicSupabaseClient } from "@/lib/supabase/public-read";
import type { Collection } from "@/types/collection";

/**
 * Load a published launch for metadata URIs (anon Supabase, then static demo).
 */
export async function loadCollectionForMetadata(slug: string): Promise<Collection | null> {
  const supabase = createPublicSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!error && data) {
      return rowToCollection(data as CollectionRow);
    }
  }
  return getCollection(slug) ?? null;
}
