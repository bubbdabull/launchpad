import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

import type { Product } from "@/lib/data/store";

/** Collection title for manage UI — works for unpublished drops owned by the wallet. */
export async function getCollectionMetaForCreator(
  slug: string,
  walletAddress: string,
): Promise<{ name: string; slug: string } | null> {
  const ok = await isCollectionCreator(slug, walletAddress);
  if (!ok) return null;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("collections").select("name,slug").eq("slug", slug).maybeSingle();
    if (error || !data) return null;
    return data as { name: string; slug: string };
  } catch {
    return null;
  }
}

export async function isCollectionCreator(slug: string, walletAddress: string): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("collections")
      .select("creator_wallet")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data?.creator_wallet) return false;
    return String(data.creator_wallet).toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

/** All products for a collection (including inactive) — service role; use only after creator check. */
export async function getProductsForManage(slug: string): Promise<Product[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("products")
      .select("id,collection_slug,name,description,image_url,price_cents,currency,inventory,active")
      .eq("collection_slug", slug)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as Product[];
  } catch {
    return [];
  }
}

export type ShopListing = {
  slug: string;
  name: string;
  tagline: string;
  bannerUrl: string;
  logoUrl: string;
  productCount: number;
};

export async function getShopListings(): Promise<ShopListing[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data: prod, error: pErr } = await supabase
      .from("products")
      .select("collection_slug")
      .eq("active", true);
    if (pErr || !prod?.length) return [];

    const counts = new Map<string, number>();
    for (const row of prod as { collection_slug: string }[]) {
      const s = row.collection_slug;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const slugs = [...counts.keys()];
    if (slugs.length === 0) return [];

    const { data: cols, error: cErr } = await supabase
      .from("collections")
      .select("slug,name,tagline,banner_url,logo_url")
      .in("slug", slugs)
      .eq("is_published", true);
    if (cErr || !cols) return [];

    return (cols as { slug: string; name: string; tagline: string; banner_url: string; logo_url: string }[]).map(
      (c) => ({
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        bannerUrl: c.banner_url,
        logoUrl: c.logo_url,
        productCount: counts.get(c.slug) ?? 0,
      }),
    );
  } catch {
    return [];
  }
}
