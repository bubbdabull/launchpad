/**
 * @apiRouteLayer L2
 * GET /api/creator/dashboard
 *
 * **Layer 2→3 only:** analytics from Supabase mirrors (`collections`,
 * `fee_distributions`, referrals). Does not define on-chain entitlement.
 *
 * Authenticated. Returns aggregate analytics across every launch owned by
 * the signed-in wallet — the data source for /dashboard.
 *
 * Per-launch and global stats:
 *   - mints (cumulative + last 24h, 7d)
 *   - mint volume (lamports)
 *   - Optional `damm_pool` for dashboard copy only (infra metadata; not lifecycle)
 *   - fees claimed (creator + platform splits)
 *   - distributions (count + total holder share)
 *   - implied APR (cached)
 *   - referrals driven by THIS creator's collections (any referrer)
 *
 * The route favors a few aggregate queries over per-row joins so the
 * dashboard renders in <200ms even for creators with many launches.
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";


import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CollectionRow = {
  slug: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  tagline: string | null;
  status: string;
  launched_at: string | null;
  damm_pool: string | null;
  minted: number;
  supply: number;
  mint_price_lamports: string | null;
  implied_apr_pct: number | null;
  volume_lamports_24h: string | null;
  volume_lamports_total: string | null;
  mints_last_hour: number | null;
  holder_count: number | null;
  is_published: boolean | null;
  alpha_vault: string | null;
  core_collection: string | null;
  category: string | null;
  genesis_pass_config: unknown | null;
};

type DistributionRow = {
  collection_slug: string;
  kind: string;
  claimed_quote_lamports: string | null;
  creator_share_lamports: string | null;
  holder_share_lamports: string | null;
  created_at: string;
};

type ReferralRow = {
  collection_slug: string;
  mint_price_lamports: string | null;
  created_at: string;
};

function safeBig(v: string | null | undefined): bigint {
  if (v == null) return BigInt(0);
  try {
    return BigInt(v);
  } catch {
    return BigInt(0);
  }
}

function traitSummaryFromGenesisPass(raw: unknown): {
  genesisTraitLayerCount: number | null;
  genesisTraitHostedOnly: boolean;
} {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { genesisTraitLayerCount: null, genesisTraitHostedOnly: false };
  }
  const o = raw as Record<string, unknown>;
  const uri = typeof o.traitConfigUri === "string" && o.traitConfigUri.trim().length > 0;
  const tc = o.traitConfig;
  if (tc && typeof tc === "object" && !Array.isArray(tc)) {
    const layers = (tc as { layers?: unknown }).layers;
    if (Array.isArray(layers) && layers.length > 0) {
      return { genesisTraitLayerCount: layers.length, genesisTraitHostedOnly: false };
    }
  }
  if (uri) return { genesisTraitLayerCount: null, genesisTraitHostedOnly: true };
  return { genesisTraitLayerCount: null, genesisTraitHostedOnly: false };
}

export async function GET() {
  const session = await getWalletSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Wallet sign-in required." }, { status: 401 });
  }
  const wallet = session.address;
  const supabase = createServiceRoleClient();

  const { data: collections, error: cErr } = await supabase
    .from("collections")
    .select(
      "slug, name, logo_url, banner_url, tagline, status, launched_at, minted, supply, mint_price_lamports, implied_apr_pct, volume_lamports_24h, volume_lamports_total, mints_last_hour, holder_count, is_published, alpha_vault, core_collection, damm_pool, category, genesis_pass_config",
    )
    .eq("creator_wallet", wallet)
    .order("launched_at", { ascending: false, nullsFirst: false });

  if (cErr) {
    return NextResponse.json({ ok: false, message: cErr.message }, { status: 500 });
  }
  const launches = (collections ?? []) as CollectionRow[];
  const slugs = launches.map((l) => l.slug);

  const distsBySlug = new Map<string, DistributionRow[]>();
  const referralsBySlug = new Map<string, ReferralRow[]>();

  if (slugs.length > 0) {
    const { data: dists } = await supabase
      .from("fee_distributions")
      .select(
        "collection_slug, kind, claimed_quote_lamports, creator_share_lamports, holder_share_lamports, created_at",
      )
      .in("collection_slug", slugs)
      .order("created_at", { ascending: false })
      .limit(2000);
    for (const d of (dists ?? []) as DistributionRow[]) {
      const list = distsBySlug.get(d.collection_slug) ?? [];
      list.push(d);
      distsBySlug.set(d.collection_slug, list);
    }

    const { data: refs } = await supabase
      .from("referrals")
      .select("collection_slug, mint_price_lamports, created_at")
      .in("collection_slug", slugs)
      .order("created_at", { ascending: false })
      .limit(5000);
    for (const r of (refs ?? []) as ReferralRow[]) {
      const list = referralsBySlug.get(r.collection_slug) ?? [];
      list.push(r);
      referralsBySlug.set(r.collection_slug, list);
    }
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  let totalCreatorClaimed = BigInt(0);
  let totalHolderDistributed = BigInt(0);
  let totalVolume24h = BigInt(0);
  let totalReferralVolume = BigInt(0);
  let totalReferralCount = 0;
  let liveCount = 0;
  let totalMinted = 0;
  let totalHolders = 0;
  let aprWeightSum = 0;
  let aprWeightWeight = 0;

  const perLaunch = launches.map((l) => {
    const dists = distsBySlug.get(l.slug) ?? [];
    let creatorClaimed = BigInt(0);
    let holderDistributed = BigInt(0);
    let creatorClaimed30d = BigInt(0);
    let creatorClaimed7d = BigInt(0);
    let distributionCount = 0;

    for (const d of dists) {
      if (d.kind !== "creator") continue;
      distributionCount += 1;
      const creatorShare = safeBig(d.creator_share_lamports);
      const holderShare = safeBig(d.holder_share_lamports);
      creatorClaimed += creatorShare;
      holderDistributed += holderShare;
      const ageMs = now - Date.parse(d.created_at);
      if (ageMs <= 30 * day) creatorClaimed30d += creatorShare;
      if (ageMs <= 7 * day) creatorClaimed7d += creatorShare;
    }

    const refs = referralsBySlug.get(l.slug) ?? [];
    let refVolume = BigInt(0);
    for (const r of refs) refVolume += safeBig(r.mint_price_lamports);
    totalReferralVolume += refVolume;
    totalReferralCount += refs.length;

    const vol24h = safeBig(l.volume_lamports_24h);
    totalVolume24h += vol24h;
    totalCreatorClaimed += creatorClaimed;
    totalHolderDistributed += holderDistributed;

    const { genesisTraitLayerCount, genesisTraitHostedOnly } = traitSummaryFromGenesisPass(l.genesis_pass_config);

    if (l.status === "live") liveCount += 1;
    totalMinted += l.minted ?? 0;
    totalHolders += l.holder_count ?? 0;

    if ((l.implied_apr_pct ?? 0) > 0 && (l.minted ?? 0) > 0) {
      aprWeightSum += (l.implied_apr_pct ?? 0) * (l.minted ?? 0);
      aprWeightWeight += l.minted ?? 0;
    }

    return {
      slug: l.slug,
      name: l.name,
      logoUrl: l.logo_url,
      bannerUrl: l.banner_url,
      tagline: l.tagline,
      status: l.status,
      dammPool: l.damm_pool,
      isOnChain: !!(l.core_collection && l.alpha_vault),
      isPublished: l.is_published !== false,
      category: l.category,
      launchedAt: l.launched_at,
      minted: l.minted ?? 0,
      supply: l.supply ?? 0,
      holderCount: l.holder_count ?? 0,
      impliedAprPct: l.implied_apr_pct ?? 0,
      volume24hLamports: vol24h.toString(),
      volumeTotalLamports: safeBig(l.volume_lamports_total).toString(),
      creatorClaimedLamports: creatorClaimed.toString(),
      creatorClaimed30dLamports: creatorClaimed30d.toString(),
      creatorClaimed7dLamports: creatorClaimed7d.toString(),
      holderDistributedLamports: holderDistributed.toString(),
      distributionCount,
      referralCount: refs.length,
      referralVolumeLamports: refVolume.toString(),
      genesisTraitLayerCount,
      genesisTraitHostedOnly,
    };
  });

  const weightedApr = aprWeightWeight > 0 ? aprWeightSum / aprWeightWeight : 0;

  return NextResponse.json({
    ok: true,
    wallet,
    summary: {
      launchCount: launches.length,
      liveCount,
      totalMinted,
      totalHolders,
      totalCreatorClaimedLamports: totalCreatorClaimed.toString(),
      totalHolderDistributedLamports: totalHolderDistributed.toString(),
      totalVolume24hLamports: totalVolume24h.toString(),
      totalReferralCount,
      totalReferralVolumeLamports: totalReferralVolume.toString(),
      weightedAprPct: weightedApr,
    },
    launches: perLaunch,
  });
}

enforceL2RouteModuleBoundary("src/app/api/creator/dashboard/route.ts", "L2:GET /api/creator/dashboard");
