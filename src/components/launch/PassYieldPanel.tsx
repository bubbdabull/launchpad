"use client";

import { useEffect, useState } from "react";

import type { Collection } from "@/types/collection";

type Props = { collection: Collection };

type YieldData = {
  passCount: number;
  mintPriceLamports: string;
  distributionCount: number;
  tokenRewardDistributionCount: number;
  lifetime: { holderShareLamports: string; perPassLamports: string };
  last30d: { holderShareLamports: string };
  last7d: { holderShareLamports: string; perPassLamports: string };
  apr: { sevenDayPct: number };
};

function lamportsToSol(lamports: string | bigint): string {
  const v = typeof lamports === "string" ? BigInt(lamports) : lamports;
  const sol = Number(v) / 1_000_000_000;
  return sol.toLocaleString(undefined, {
    minimumFractionDigits: sol < 1 ? 4 : 2,
    maximumFractionDigits: sol < 0.01 ? 6 : 4,
  });
}

/**
 * Pass-yield panel — public, shown on every launch page.
 *
 * Reads /api/launches/[slug]/yield (a public, aggregate-only endpoint) and
 * renders three numbers that turn the Genesis Pass into a visibly
 * yield-bearing instrument:
 *
 *   1. Earned per pass (lifetime)   — every lamport ever distributed to
 *                                     this Pass position
 *   2. Earned per pass (last 7 days) — recency signal; what the Pass is
 *                                     paying right now
 *   3. Implied 7d APR                — annualized yield based on the last
 *                                     7 days, denominated against mint
 *                                     price
 *
 * The panel hides itself until the launch has a Metaplex Core collection on-chain
 * (fee routing is indexed against that deployment).
 */
export function PassYieldPanel({ collection: c }: Props) {
  const [data, setData] = useState<YieldData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/launches/${c.slug}/yield`, { cache: "no-store" });
        const j = (await r.json()) as YieldData & { ok: boolean; message?: string };
        if (!r.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load yield.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [c.slug]);

  if (!c.coreCollection) return null;

  const symbol = c.tokenSymbol ?? "TOKEN";
  const lifetimePerPass = data?.lifetime.perPassLamports ?? "0";
  const sevenDayPerPass = data?.last7d.perPassLamports ?? "0";
  const apr = data?.apr.sevenDayPct ?? 0;
  const distCount = data?.distributionCount ?? 0;
  const tokenRewardCount = data?.tokenRewardDistributionCount ?? 0;
  const noActivity = distCount === 0 && tokenRewardCount === 0;

  return (
    <section className="rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-400/[0.05] to-transparent p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-emerald-300">Pass yield</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white">
            What this ${symbol} Pass is earning
          </h2>
        </div>
        {distCount > 0 ? (
          <p className="text-[11px] text-muted">
            {distCount} fee distribution{distCount === 1 ? "" : "s"} · weighted by hold time
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <YieldStat
          label="Earned per Pass · lifetime"
          value={`${lamportsToSol(lifetimePerPass)} SOL`}
          hint="all distributions since launch"
        />
        <YieldStat
          label="Earned per Pass · last 7d"
          value={`${lamportsToSol(sevenDayPerPass)} SOL`}
          hint="recent fee distribution rate"
        />
        <YieldStat
          label="Implied 7d APR"
          value={apr > 0 ? `${apr.toFixed(1)}%` : "—"}
          hint="annualized; estimate, not a promise"
          highlight={apr > 0}
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {noActivity && !error ? (
        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          No fee distributions have been recorded yet. Numbers populate as the DAMM pool trades and fee splits are
          recorded for this collection.
        </p>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Every Pass earns a share of the creator's 2% trading-fee pot. Distributions are weighted by how long you've
        held — diamond hands earn up to 2× a fresh-mint flipper. Selling means giving up all future yield to the buyer.
      </p>
    </section>
  );
}

function YieldStat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
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
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}
