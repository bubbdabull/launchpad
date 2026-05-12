"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Activity, Gauge, Radar, Waves } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { LiveBadge } from "@/components/ui/live-badge";
import { NeonButton } from "@/components/ui/neon-button";
import { StatusPulse } from "@/components/ui/status-pulse";
import { LiquidityMicroChart } from "@/components/trade/liquidity-micro-chart";
import { TradeMomentumChart } from "@/components/trade/trade-momentum-chart";
import { UI_NON_AUTHORITY_DISCLAIMER } from "@/lib/ui/architecture-ui";
import type { Collection } from "@/types/collection";

const tapeRows = [
  { icon: Activity, label: "Activity tape", sub: "Mints + swaps surface here when wired to indexer feeds." },
  { icon: Waves, label: "Liquidity motion", sub: "Pool depth is mirrored from Meteora + RPC — not a quote engine." },
  { icon: Gauge, label: "Fee generation", sub: "Displays accrued labels only; claims happen in authorized programs." },
  { icon: Radar, label: "Social sentiment", sub: "Heuristic badges — cosmetic, never payout logic." },
];

export function TradeBattlefield({ collection: c }: { collection: Collection }) {
  const pool = c.dammPool;
  return (
    <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 cm-grid-bg opacity-25" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-red-300/90">Trade deck</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">{c.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            DAMM v2 context + synthetic tape for vibe — read-only. Execute swaps in your wallet or Meteora; we never settle
            trades or infer claimable balances.
          </p>
          <p className="mt-2 text-[11px] text-muted">{UI_NON_AUTHORITY_DISCLAIMER}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "live" ? <LiveBadge label="POOL LIVE" /> : null}
          <NeonButton href={`/mint/${c.slug}`} variant="primary">
            Mint Genesis Pass
          </NeonButton>
          <NeonButton href={`/launch/${c.slug}`} variant="ghost">
            Launch intel
          </NeonButton>
        </div>
      </div>

      <div className="relative mt-10 grid gap-4 lg:grid-cols-3">
        <GlassCard glow="neon" className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">DAMM v2 · mirrored ref</p>
            <StatusPulse tone={pool ? "success" : "warning"} />
          </div>
          <p className="mt-3 break-all font-mono text-sm text-white">
            {pool ?? "Pool pubkey not cached — infra metadata only (not lifecycle authority)."}
          </p>
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Illustrative momentum</p>
            <TradeMomentumChart slug={c.slug} />
          </div>
        </GlassCard>
        <GlassCard glow="violet">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">24h tape</p>
          <p className="mt-3 font-display text-3xl text-white">{c.volume24h ?? "—"}</p>
          <p className="mt-2 text-[11px] text-muted">Label from indexer mirror — not a guarantee of PnL.</p>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Synthetic liquidity strip</p>
            <LiquidityMicroChart slug={c.slug} />
          </div>
        </GlassCard>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="relative mt-8 grid gap-3 md:grid-cols-2"
      >
        {tapeRows.map(({ icon: Icon, label, sub }) => (
          <GlassCard key={label} className="border-white/5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-accent">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
                <p className="mt-2 text-sm text-white/75">{sub}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </motion.div>

      <p className="relative mt-8 text-center text-[11px] text-muted">
        Primary story & vault wiring live on{" "}
        <Link href={`/launch/${c.slug}`} className="text-accent hover:underline">
          /launch/{c.slug}
        </Link>
        .
      </p>
    </div>
  );
}
