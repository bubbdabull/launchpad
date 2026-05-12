"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useMemo, useRef } from "react";

import { cn } from "@/lib/ui/cn";
import { pct } from "@/lib/format";
import type { Collection } from "@/types/collection";

import { UI_NON_AUTHORITY_DISCLAIMER } from "@/lib/ui/architecture-ui";

export type LiveFeedRow = {
  id: string;
  title: string;
  sub: string;
  href?: string;
  tone?: "mint" | "vault" | "whale" | "neutral";
};

function buildSyntheticFeed(collections: Collection[], limit = 48): LiveFeedRow[] {
  const rows: LiveFeedRow[] = [];
  const live = collections.filter((c) => c.status === "live");
  for (const c of live.slice(0, 12)) {
    const fill = pct(c.minted, c.supply);
    rows.push({
      id: `m-${c.slug}`,
      title: `Mint pulse · ${c.name}`,
      sub: `${c.mintsLastHour ?? 0} mints/h · ${fill}% filled (mirror)`,
      href: `/mint/${c.slug}`,
      tone: (c.mintsLastHour ?? 0) > 5 ? "mint" : "neutral",
    });
  }
  for (const c of [...collections].sort((a, b) => b.minted - a.minted).slice(0, 10)) {
    rows.push({
      id: `v-${c.slug}`,
      title: `Vault tape · ${c.name}`,
      sub: c.volume24h ? `${c.volume24h} · 24h label` : "Quiet tape · indexer mirror",
      href: `/launch/${c.slug}`,
      tone: "vault",
    });
  }
  for (const c of collections.filter((x) => (x.holderCount ?? 0) > 200).slice(0, 6)) {
    rows.push({
      id: `w-${c.slug}`,
      title: `Whale radar · ${c.name}`,
      sub: `${(c.holderCount ?? 0).toLocaleString()} holders (snapshot · not authority)`,
      href: `/project/${c.slug}/trade`,
      tone: "whale",
    });
  }
  return rows.slice(0, limit);
}

const toneDot: Record<NonNullable<LiveFeedRow["tone"]>, string> = {
  mint: "bg-accent shadow-[0_0_12px_rgba(34,245,158,0.55)]",
  vault: "bg-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.45)]",
  whale: "bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]",
  neutral: "bg-white/40",
};

export function LiveActivityFeed({
  collections,
  className,
}: {
  collections: Collection[];
  className?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => buildSyntheticFeed(collections), [collections]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  return (
    <div className={cn("cm-glass flex flex-col overflow-hidden rounded-2xl", className)}>
      <div className="border-b border-white/10 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Live activity</p>
        <p className="mt-1 font-display text-sm font-semibold text-white">Participation wire</p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted">{UI_NON_AUTHORITY_DISCLAIMER}</p>
      </div>
      <div ref={parentRef} className="h-[min(420px,52vh)] overflow-auto">
        <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const row = items[vi.index];
            const dot = toneDot[row.tone ?? "neutral"];
            const inner = (
              <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{row.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{row.sub}</p>
                </div>
              </div>
            );
            return (
              <div
                key={row.id}
                className="absolute left-0 right-0 border-b border-white/[0.04] hover:bg-white/[0.03]"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                {row.href ? (
                  <Link href={row.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
