"use client";

import { motion } from "framer-motion";

import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { RarityFrame } from "@/components/ui/rarity-frame";

import type { ReactNode } from "react";

export function MintEnergyShell({ children, slug }: { children: ReactNode; slug: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,245,158,0.08),transparent_50%)]" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <GlassCard glow="neon" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Mint runway</p>
            <p className="mt-1 font-display text-base font-semibold text-white">One signature: vault deposit + Genesis Pass.</p>
            <p className="mt-1 text-xs text-muted">Program rules are final — this panel only builds the transaction.</p>
          </div>
          <NeonButton href={`/launch/${slug}`} variant="ghost">
            Launch page
          </NeonButton>
        </GlassCard>
      </motion.div>
      <RarityFrame tier="genesis">
        <div className="p-4 sm:p-6">{children}</div>
      </RarityFrame>
    </div>
  );
}
