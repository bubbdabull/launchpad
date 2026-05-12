import { createClient } from "@/lib/supabase/server";

export type Product = {
  id: string;
  collection_slug: string;
  name: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  currency: string;
  inventory: number;
  active: boolean;
};

export async function getProductsByCollectionSlug(slug: string): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id,collection_slug,name,description,image_url,price_cents,currency,inventory,active")
      .eq("collection_slug", slug)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as Product[];
  } catch {
    return [];
  }
}

