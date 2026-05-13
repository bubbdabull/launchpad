"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import type { GenesisPassNftConfig } from "@/types/genesis-pass-nft";
import { genesisRevealPhase, parseRevealAtMs } from "@/lib/nft-generation/reveal/gate";

type Props = { slug: string; config: GenesisPassNftConfig };

export function GenesisGenerativeBanner({ slug, config }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const phase = genesisRevealPhase(now, config);
  const revealMs = parseRevealAtMs(config);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const remaining =
    phase === "unrevealed" && revealMs != null ? Math.max(0, revealMs - now) : 0;
  const days = Math.floor(remaining / 86400000);
  const hrs = Math.floor((remaining % 86400000) / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 via-panel to-panel p-4 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,245,158,0.18),transparent_55%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Generative Genesis Pass</p>
          <p className="mt-1 text-sm font-medium text-white">
            {phase === "unrevealed" ? "Reveal pending · traits hidden in metadata" : "Revealed · full traits live in metadata"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Rarity is cosmetic only — claims and allocation stay on-chain (MintReceipt / LaunchState).
          </p>
        </div>
        {phase === "unrevealed" && revealMs != null ? (
          <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs text-white sm:text-sm">
            <div className="rounded-xl bg-black/40 px-2 py-2 ring-1 ring-white/10">
              <p className="text-[10px] uppercase text-muted">Days</p>
              <p className="text-lg font-semibold">{days}</p>
            </div>
            <div className="rounded-xl bg-black/40 px-2 py-2 ring-1 ring-white/10">
              <p className="text-[10px] uppercase text-muted">Hrs</p>
              <p className="text-lg font-semibold">{hrs}</p>
            </div>
            <div className="rounded-xl bg-black/40 px-2 py-2 ring-1 ring-white/10">
              <p className="text-[10px] uppercase text-muted">Min</p>
              <p className="text-lg font-semibold">{mins}</p>
            </div>
            <div className="rounded-xl bg-black/40 px-2 py-2 ring-1 ring-white/10">
              <p className="text-[10px] uppercase text-muted">Sec</p>
              <p className="text-lg font-semibold">{secs}</p>
            </div>
          </div>
        ) : null}
      </div>
      <p className="relative mt-3 text-[10px] text-muted/80">Launch · {slug}</p>
    </motion.div>
  );
}
