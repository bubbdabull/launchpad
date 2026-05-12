import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollectionCard } from "@/components/launchpad/CollectionCard";
import { OwnerLaunchManageList } from "@/components/creator/OwnerLaunchManageList";
import { ProfileEditor } from "@/components/creator/ProfileEditor";
import { getWalletSession } from "@/lib/auth/session";
import { getCreatorProfile } from "@/lib/creators/profiles";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rowToCollection, type CollectionRow } from "@/lib/supabase/map-collection";
import type { Collection } from "@/types/collection";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type PageProps = { params: Promise<{ wallet: string }> };

function shortAddress(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export default async function CreatorPage({ params }: PageProps) {
  const { wallet } = await params;
  if (!BASE58_RE.test(wallet)) notFound();

  const profile = await getCreatorProfile(wallet);
  const session = await getWalletSession();
  const isOwner = session?.address === wallet;

  // Pull every collection by this creator. Owners see drafts + hidden;
  // visitors see only published rows.
  const supabase = createServiceRoleClient();
  let collectionsQuery = supabase
    .from("collections")
    .select("*")
    .eq("creator_wallet", wallet)
    .order("launched_at", { ascending: false, nullsFirst: false });
  if (!isOwner) collectionsQuery = collectionsQuery.eq("is_published", true);
  const { data: rows } = await collectionsQuery;

  const allLaunches: Collection[] = (rows ?? []).map((r) => rowToCollection(r as CollectionRow));
  const visibleLaunches: Collection[] = allLaunches;

  // No profile + no launches + no session-owner = nothing to show.
  if (!profile && allLaunches.length === 0 && !isOwner) notFound();

  const displayName = profile?.displayName ?? shortAddress(wallet);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-5 rounded-2xl border border-line bg-panel/40 p-6 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-line bg-ink">
          {profile?.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-muted">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {displayName}
            </h1>
            {profile?.verified ? (
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                ✓ Verified
              </span>
            ) : null}
          </div>
          <p className="font-mono text-xs text-muted">{wallet}</p>
          {profile?.bio ? (
            <p className="max-w-prose pt-2 text-sm text-muted">{profile.bio}</p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-2 text-xs">
            {profile?.twitterHandle ? (
              <a
                href={`https://x.com/${profile.twitterHandle}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted underline hover:text-white"
              >
                @{profile.twitterHandle}
              </a>
            ) : null}
            {profile?.websiteUrl ? (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted underline hover:text-white"
              >
                {profile.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:max-w-xs sm:grid-cols-2">
          <Stat label="Launches" value={(profile?.launchCount ?? allLaunches.length).toString()} />
          <Stat label="Holders" value={(profile?.totalHoldersEstimate ?? 0).toString()} />
        </div>
      </header>

      {isOwner ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.04] p-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-accent">Owner shortcuts</p>
              <p className="mt-1 text-sm text-white">
                Run analytics, edit launches, and open deploy tools from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                Open dashboard
              </Link>
              <Link
                href="/create"
                className="rounded-full border border-line bg-panel px-4 py-2 text-sm text-white hover:border-white/30"
              >
                + New launch
              </Link>
            </div>
          </div>
          <ProfileEditor wallet={wallet} initial={profile} />
        </>
      ) : null}

      {isOwner ? (
        <OwnerLaunchManageList launches={allLaunches} />
      ) : (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white">Launches</h2>
          {visibleLaunches.length === 0 ? (
            <div className="rounded-2xl border border-line bg-panel/40 p-6 text-sm text-muted">
              No launches yet.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {visibleLaunches.map((c) => (
                <CollectionCard key={c.slug} c={c} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink p-3 text-center">
      <p className="font-display text-lg font-semibold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
