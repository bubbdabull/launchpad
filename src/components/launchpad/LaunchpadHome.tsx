"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Collection, MintStatus } from "@/types/collection";

import { CollectionCard } from "./CollectionCard";
import { FilterToolbar, type SortKey } from "./FilterToolbar";

type Props = {
  collections: Collection[];
};

/**
 * Discovery feed.
 *
 * SSR delivers an initial page of collections (the same trending list as
 * before) so the grid renders before any JS runs. Once the user touches
 * a filter, sort, search input, or category chip, we re-fetch from
 * `/api/launches/index` server-side so we don't have to ship every column
 * for every launch up front.
 *
 * The "default state" (sort=trending, status=all, no query, no category,
 * verified off) intentionally stays SSR — the API call only
 * fires when the user changes something, so first-paint stays cached.
 */
export function LaunchpadHome({ collections }: Props) {
  const [status, setStatus] = useState<"all" | MintStatus>("all");
  const [sort, setSort] = useState<SortKey>("trending");
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const [serverCards, setServerCards] = useState<Collection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We only hit the API once any filter changes from default. This keeps
  // the default home grid CDN-cacheable.
  const isDefault =
    status === "all" &&
    sort === "trending" &&
    q === "" &&
    !verified &&
    category == null;

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (isDefault) {
      setServerCards(null);
      setError(null);
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        if (sort !== "trending") params.set("sort", sort);
        if (q.trim()) params.set("q", q.trim());
        if (verified) params.set("verified", "1");
        if (category) params.set("category", category);
        params.set("limit", "60");

        const res = await fetch(`/api/launches/index?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as
          | { ok: true; cards: Collection[] }
          | { ok: false; message: string };
        if (!res.ok || !json.ok) {
          throw new Error(("message" in json && json.message) || `HTTP ${res.status}`);
        }
        setServerCards(json.cards);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load launches.");
      } finally {
        setLoading(false);
      }
    }, q.trim() === "" ? 0 : 200);
    debounceRef.current = handle;

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [isDefault, status, sort, q, verified, category]);

  const list = useMemo(() => serverCards ?? collections, [serverCards, collections]);

  return (
    <div className="space-y-10">
      <DiscoveryRails collections={collections} />

      <div id="launches" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">All launches</h2>
            <p className="mt-1 text-sm text-muted">{list.length} shown</p>
          </div>
          {loading ? <span className="text-sm text-muted">Loading…</span> : null}
        </div>

        <FilterToolbar
          status={status}
          onStatus={setStatus}
          sort={sort}
          onSort={setSort}
          q={q}
          onQ={setQ}
          verified={verified}
          onVerified={setVerified}
          category={category}
          onCategory={setCategory}
        />

        {error ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        {list.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel/40 p-10 text-center text-sm text-muted">
            No launches match these filters.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <CollectionCard key={c.slug} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Top "rails" above the All-launches grid. Each rail is a small horizontal
 * preview of one curated cut of the data (Highest APR, Filling Fast, DAMM
 * liquidity). They use the SSR-loaded `collections` so they render
 * instantly and don't fan out into separate API calls.
 *
 * Hidden when there aren't enough launches to fill at least one rail —
 * cleaner empty state during early platform days.
 */
function DiscoveryRails({ collections }: { collections: Collection[] }) {
  // Rails use mint status for eligibility; `damm_pool` below is only for a **UI** slice (not lifecycle).
  const eligible = collections.filter((c) => c.status === "live" || c.status === "sold_out");
  if (eligible.length < 3) return null;

  const byApr = [...eligible]
    .filter((c) => (c.impliedAprPct ?? 0) > 0)
    .sort((a, b) => (b.impliedAprPct ?? 0) - (a.impliedAprPct ?? 0))
    .slice(0, 6);

  const filling = [...eligible]
    .filter((c) => c.status === "live")
    .sort((a, b) => (b.mintsLastHour ?? 0) - (a.mintsLastHour ?? 0))
    .slice(0, 6);

  const lamportsOr0 = (s: string | undefined) => {
    try {
      return BigInt(s ?? "0");
    } catch {
      return BigInt(0);
    }
  };
  // UI-only rail: cached pool ref + volume — not LaunchState or eligibility for anything on-chain.
  const dammLinked = [...collections]
    .filter((c) => !!c.dammPool)
    .sort((a, b) => {
      const av = lamportsOr0(a.volumeLamports24h);
      const bv = lamportsOr0(b.volumeLamports24h);
      if (bv > av) return 1;
      if (bv < av) return -1;
      return 0;
    })
    .slice(0, 6);

  const rails: Array<{
    title: string;
    sub: string;
    items: Collection[];
    tone: "emerald" | "accent" | "violet";
  }> = [];
  if (byApr.length >= 2) {
    rails.push({
      title: "Highest APR",
      sub: "Genesis Pass yield · 7d",
      items: byApr,
      tone: "emerald",
    });
  }
  if (filling.length >= 2) {
    rails.push({
      title: "Filling fast",
      sub: "Most mints · last hour",
      items: filling,
      tone: "accent",
    });
  }
  if (dammLinked.length >= 2) {
    rails.push({
      title: "Pool volume",
      sub: "DAMM linked · 24h (cached)",
      items: dammLinked,
      tone: "violet",
    });
  }
  if (rails.length === 0) return null;

  return (
    <div className="space-y-10">
      {rails.map((rail) => (
        <DiscoveryRail key={rail.title} {...rail} />
      ))}
    </div>
  );
}

function DiscoveryRail({
  title,
  sub,
  items,
  tone,
}: {
  title: string;
  sub: string;
  items: Collection[];
  tone: "emerald" | "accent" | "violet";
}) {
  const tonePill =
    tone === "emerald"
      ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"
      : tone === "violet"
        ? "bg-violet-500/15 text-violet-200 ring-violet-400/30"
        : "bg-accent/15 text-accent ring-accent/40";

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${tonePill}`}>
            {title}
          </span>
          <p className="mt-2 text-sm text-muted">{sub}</p>
        </div>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {items.map((c) => (
          <div key={c.slug} className="w-[280px] shrink-0 snap-start sm:w-[320px]">
            <CollectionCard c={c} />
          </div>
        ))}
      </div>
    </section>
  );
}
