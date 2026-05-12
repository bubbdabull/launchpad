import Image from "next/image";
import Link from "next/link";

import { pct } from "@/lib/format";
import type { Collection } from "@/types/collection";

function statusBadge(status: Collection["status"]) {
  switch (status) {
    case "live":
      return { label: "Live", className: "bg-accent/15 text-accent ring-accent/35" };
    case "upcoming":
      return { label: "Soon", className: "bg-amber-500/15 text-amber-200 ring-amber-400/25" };
    default:
      return { label: "Sold out", className: "bg-white/10 text-muted ring-white/10" };
  }
}

export function CollectionCard({ c }: { c: Collection }) {
  const badge = statusBadge(c.status);
  const tokenLabel = c.tokenSymbol ? `$${c.tokenSymbol}` : "Token";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-glow">
      <Link
        href={`/launch/${c.slug}`}
        className="absolute inset-x-0 top-0 z-0 h-[calc(100%-4.5rem)]"
        aria-label={`Open ${c.name}`}
      />
      <div className="relative aspect-[16/9] w-full">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={c.bannerUrl}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            sizes="(max-width:768px) 100vw, 33vw"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${badge.className}`}
          >
            {badge.label}
          </span>
          {c.dammPool ? (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/80 ring-1 ring-white/15 backdrop-blur">
              Pool
            </span>
          ) : (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15 backdrop-blur">
              {tokenLabel}
            </span>
          )}
        </div>
        <div className="absolute -bottom-8 left-4 z-10 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg">
          <Image src={c.logoUrl} alt="" width={64} height={64} className="object-cover" />
        </div>
      </div>
      <div className="relative z-10 flex flex-1 flex-col gap-2 p-5 pt-10">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-white group-hover:text-accent">
            {c.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>by {c.creatorDisplayName ?? c.creator}</span>
            {c.creatorVerified ? <VerifiedDot /> : null}
            {(c.impliedAprPct ?? 0) > 0 ? (
              <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/30">
                {c.impliedAprPct!.toFixed(1)}% APR
              </span>
            ) : null}
          </p>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{c.description}</p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line/80 pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Minted</p>
            <p className="text-sm font-medium text-white">
              {c.minted.toLocaleString()} / {c.supply.toLocaleString()}{" "}
              <span className="text-muted">({pct(c.minted, c.supply)}%)</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Price</p>
            <p className="text-sm font-semibold text-white">{c.priceLabel}</p>
          </div>
        </div>
        {c.utilities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.utilities.slice(0, 3).map((u) => (
              <span
                key={u}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted ring-1 ring-white/10"
              >
                {u}
              </span>
            ))}
          </div>
        )}
        <div className="relative z-20 flex gap-2 pt-1">
          <Link
            href={`/mint/${c.slug}`}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-accent py-2.5 text-sm font-semibold text-ink shadow-[0_0_20px_rgba(34,245,158,0.2)] transition hover:brightness-110"
          >
            Mint
          </Link>
          <Link
            href={`/launch/${c.slug}`}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-accent/35 hover:bg-white/[0.1]"
          >
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}

function VerifiedDot() {
  return (
    <span
      title="Verified creator"
      aria-label="Verified creator"
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent ring-1 ring-accent/40"
    >
      ✓
    </span>
  );
}
