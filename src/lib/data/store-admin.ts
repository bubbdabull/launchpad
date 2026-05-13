import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

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
