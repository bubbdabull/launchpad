"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type LaunchRow = {
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  tagline: string | null;
  status: string;
  dammPool: string | null;
  isOnChain: boolean;
  isPublished: boolean;
  category: string | null;
  launchedAt: string | null;
  minted: number;
  supply: number;
  holderCount: number;
  impliedAprPct: number;
  volume24hLamports: string;
  volumeTotalLamports: string;
  creatorClaimedLamports: string;
  creatorClaimed30dLamports: string;
  creatorClaimed7dLamports: string;
  holderDistributedLamports: string;
  distributionCount: number;
  referralCount: number;
  referralVolumeLamports: string;
  genesisTraitLayerCount: number | null;
  genesisTraitHostedOnly: boolean;
};

type Resp =
  | {
      ok: true;
      summary: {
        launchCount: number;
        liveCount: number;
        totalMinted: number;
        totalHolders: number;
        totalCreatorClaimedLamports: string;
        totalHolderDistributedLamports: string;
        totalVolume24hLamports: string;
        totalReferralCount: number;
        totalReferralVolumeLamports: string;
        weightedAprPct: number;
      };
      launches: LaunchRow[];
    }
  | { ok: false; message: string };

function lamportsToSol(s: string, opts: { compact?: boolean } = {}): string {
  let v: bigint;
  try {
    v = BigInt(s);
  } catch {
    return "—";
  }
  const n = Number(v) / 1_000_000_000;
  if (opts.compact && n >= 1000) {
    return `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 0.01 ? 6 : 2,
  });
}

export function CreatorDashboard() {
  const [data, setData] = useState<Extract<Resp, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/creator/dashboard", { cache: "no-store" });
        const j = (await r.json()) as Resp;
        if (!j.ok) throw new Error(j.message);
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load dashboard.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
        {error}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-panel/40 p-8 text-sm text-muted">
        Loading dashboard…
      </div>
    );
  }

  const s = data.summary;

  if (s.launchCount === 0) {
    return (
      <div className="rounded-2xl border border-line bg-panel/40 p-8 text-sm text-muted">
        You don&rsquo;t have any launches on this wallet yet.{" "}
        <Link href="/create" className="underline hover:text-white">
          Create one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat
          label="Launches"
          value={s.launchCount.toString()}
          hint={`${s.liveCount} live`}
        />
        <SummaryStat
          label="Total minted"
          value={s.totalMinted.toLocaleString()}
          hint={`${s.totalHolders.toLocaleString()} holders`}
        />
        <SummaryStat
          label="Creator fees claimed"
          value={`${lamportsToSol(s.totalCreatorClaimedLamports)} SOL`}
          hint={`${lamportsToSol(s.totalHolderDistributedLamports)} SOL to holders`}
          highlight
        />
        <SummaryStat
          label="Weighted 7d APR"
          value={s.weightedAprPct > 0 ? `${s.weightedAprPct.toFixed(1)}%` : "—"}
          hint={`${lamportsToSol(s.totalVolume24hLamports)} SOL · 24h volume`}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Your launches</h2>
            <p className="text-sm text-muted">
              Each card has direct links to edit the launch, manage its store, and view the public pages.
            </p>
          </div>
          <Link
            href="/create"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            + New launch
          </Link>
        </div>

        <div className="grid gap-4">
          {data.launches.map((l) => (
            <LaunchManageCard key={l.slug} launch={l} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel/40 p-6 text-xs leading-relaxed text-muted">
        <p>
          These numbers come from the chain and can update a bit later on the screen. They&apos;re for your
          dashboard—Solana still decides what&apos;s really owed.
        </p>
      </section>
    </div>
  );
}

function LaunchManageCard({ launch: l }: { launch: LaunchRow }) {
  // Status from publish + on-chain readiness + mint status only — never from `damm_pool` (infra metadata).
  const statusLabel = !l.isPublished
    ? "Hidden"
    : !l.isOnChain
      ? "Draft · not deployed"
      : l.status === "live"
        ? "Mint live"
        : l.status;
  const statusTone = !l.isPublished
    ? "border-amber-400/30 bg-amber-400/[0.04] text-amber-200"
    : !l.isOnChain
      ? "border-amber-400/30 bg-amber-400/[0.04] text-amber-200"
      : "border-emerald-400/30 bg-emerald-400/[0.04] text-emerald-200";

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel/40">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-3 sm:w-[260px]">
          <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-line bg-ink">
            {l.logoUrl ? (
              <Image src={l.logoUrl} alt="" fill sizes="56px" className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="truncate font-display text-base font-semibold text-white">{l.name}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${statusTone}`}
              >
                {statusLabel}
              </span>
            </div>
            {l.tagline ? (
              <p className="line-clamp-1 text-[11px] text-muted">{l.tagline}</p>
            ) : null}
            <p className="mt-1 text-[11px] text-muted">
              {l.minted.toLocaleString()}/{l.supply.toLocaleString()} minted
              {l.holderCount > 0 ? <> · {l.holderCount.toLocaleString()} holders</> : null}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <KV
              label="Vol 24h"
              value={`${lamportsToSol(l.volume24hLamports, { compact: true })} SOL`}
            />
            <KV
              label="Claimed"
              value={`${lamportsToSol(l.creatorClaimedLamports)} SOL`}
              tone="emerald"
            />
            <KV
              label="To holders"
              value={`${lamportsToSol(l.holderDistributedLamports)} SOL`}
              tone="violet"
            />
            <KV
              label="7d APR"
              value={l.impliedAprPct > 0 ? `${l.impliedAprPct.toFixed(1)}%` : "—"}
              tone={l.impliedAprPct > 0 ? "emerald" : "muted"}
            />
            <KV label="Referrals" value={l.referralCount.toLocaleString()} />
            {l.dammPool ? (
              <KV
                label="DAMM pool (infra)"
                value={`${l.dammPool.slice(0, 6)}…${l.dammPool.slice(-4)}`}
                tone="muted"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <ManageBtn href={`/project/${l.slug}/manage`} label="Edit launch" highlight />
            <ManageBtn href={`/project/${l.slug}/manage#genesis-pass-traits`} label="Trait setup" />
            <ManageBtn href={`/launch/${l.slug}`} label="Trade page" />
            <ManageBtn href={`/project/${l.slug}`} label="Project page" />
            <ManageBtn href={`/mint/${l.slug}`} label="Mint page" />
            {!l.isOnChain ? (
              <ManageBtn
                href={`/launch/${l.slug}`}
                label="Deploy on-chain →"
                tone="warning"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-baseline gap-2 border-t border-line/60 pt-3 text-[11px] text-muted">
            <span className="font-medium text-white/70">Genesis traits</span>
            <span>
              {l.genesisTraitLayerCount != null
                ? `${l.genesisTraitLayerCount} layer${l.genesisTraitLayerCount === 1 ? "" : "s"} saved on launch`
                : l.genesisTraitHostedOnly
                  ? "Using hosted JSON URL"
                  : "Not configured"}
            </span>
            <span className="text-muted">·</span>
            <Link href={`/project/${l.slug}/manage#genesis-pass-traits`} className="text-accent hover:underline">
              Edit JSON
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "violet" | "muted";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "violet"
        ? "text-violet-200"
        : tone === "muted"
          ? "text-muted"
          : "text-white";
  return (
    <div className="rounded-lg border border-line/60 bg-ink/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}

function ManageBtn({
  href,
  label,
  highlight,
  tone,
}: {
  href: string;
  label: string;
  highlight?: boolean;
  tone?: "warning";
}) {
  const cls =
    tone === "warning"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
      : highlight
        ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
        : "border-line bg-panel/30 text-muted hover:text-white hover:border-white/20";
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${cls}`}
    >
      {label}
    </Link>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-emerald-400/30 bg-emerald-400/[0.04]"
          : "border-line bg-panel/40"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          highlight ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
