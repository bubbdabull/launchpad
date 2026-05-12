"use client";

import { motion } from "framer-motion";

import { GlassCard } from "@/components/ui/glass-card";
import { LiveBadge } from "@/components/ui/live-badge";
import { StatusPulse } from "@/components/ui/status-pulse";

type Props = {
  name: string;
  minted: number;
  supply: number;
  status: string;
  volume24h?: string | null;
  alphaVault?: string | null;
};

export function LiveLaunchRail({ name, minted, supply, status, volume24h, alphaVault }: Props) {
  const fill = Math.round((minted / Math.max(supply, 1)) * 100);
  const feed = [
    { id: "1", label: "Vault heartbeat", sub: alphaVault ? "Mirrored · verify on explorer" : "Wire vault to go live" },
    { id: "2", label: "Passes gone", sub: `${minted.toLocaleString()} / ${supply.toLocaleString()} printed` },
    { id: "3", label: "24h tape", sub: volume24h ?? "Quiet · be first" },
  ];

  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <GlassCard glow="violet">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Ticker rail</p>
          {status === "live" ? <LiveBadge label="LIVE" /> : <span className="text-[10px] text-muted">{status}</span>}
        </div>
        <p className="mt-2 font-display text-lg font-semibold text-white">{name}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-300"
            initial={{ width: 0 }}
            animate={{ width: `${fill}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted">Fill {fill}% · mirror UX · confirm on-chain</p>
      </GlassCard>
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted">Floor pulse</p>
        {feed.map((row, i) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i }}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5"
          >
            <StatusPulse tone={i === 0 ? "success" : "neutral"} />
            <div>
              <p className="text-xs font-medium text-white">{row.label}</p>
              <p className="text-[11px] text-muted">{row.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted">
        Hype is for humans; balances are on Solana. Always verify vault + mint accounts yourself.
      </p>
    </div>
  );
}
