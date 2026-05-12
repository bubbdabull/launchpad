/**
 * Server-only creator-profile helpers.
 *
 * The creator_profiles table is the source of truth for verification +
 * display name. Profiles are created lazily — we don't require a creator
 * to manually onboard before they ship a launch. Read paths therefore
 * always tolerate a missing row by returning safe defaults.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export type CreatorProfile = {
  wallet: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  twitterHandle: string | null;
  discordHandle: string | null;
  websiteUrl: string | null;
  verified: boolean;
  verifiedAt: string | null;
  launchCount: number;
  totalHoldersEstimate: number;
};

type Row = {
  wallet: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  discord_handle: string | null;
  website_url: string | null;
  verified: boolean;
  verified_at: string | null;
  launch_count: number;
  total_holders_estimate: number;
};

function rowToProfile(r: Row): CreatorProfile {
  return {
    wallet: r.wallet,
    displayName: r.display_name,
    bio: r.bio,
    avatarUrl: r.avatar_url,
    twitterHandle: r.twitter_handle,
    discordHandle: r.discord_handle,
    websiteUrl: r.website_url,
    verified: r.verified,
    verifiedAt: r.verified_at,
    launchCount: r.launch_count,
    totalHoldersEstimate: r.total_holders_estimate,
  };
}

export async function getCreatorProfile(wallet: string): Promise<CreatorProfile | null> {
  if (!wallet) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data as Row);
}

export async function getCreatorProfilesByWallets(
  wallets: string[],
): Promise<Map<string, CreatorProfile>> {
  const out = new Map<string, CreatorProfile>();
  const unique = Array.from(new Set(wallets.filter(Boolean)));
  if (unique.length === 0) return out;

  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("creator_profiles").select("*").in("wallet", unique);
  for (const row of (data ?? []) as Row[]) {
    out.set(row.wallet, rowToProfile(row));
  }
  return out;
}

/**
 * Refresh denormalized counters from the collections table. Called by:
 *   - the deploy-on-chain endpoint (after a creator's first launch)
 *   - the admin /api/admin/verify-creator endpoint
 *   - any future cron that wants to keep these honest
 */
export async function refreshCreatorCounters(wallet: string): Promise<CreatorProfile | null> {
  const supabase = createServiceRoleClient();

  const { data: rows } = await supabase
    .from("collections")
    .select("holder_count")
    .eq("creator_wallet", wallet);

  const launchCount = (rows ?? []).length;
  const totalHolders = (rows ?? []).reduce(
    (s, r) => s + ((r as { holder_count: number | null }).holder_count ?? 0),
    0,
  );

  await supabase.from("creator_profiles").upsert(
    {
      wallet,
      launch_count: launchCount,
      total_holders_estimate: totalHolders,
    },
    { onConflict: "wallet" },
  );

  return getCreatorProfile(wallet);
}
