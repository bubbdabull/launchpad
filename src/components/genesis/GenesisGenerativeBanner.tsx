"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import type { GenesisPassNftConfig } from "@/types/genesis-pass-nft";
import { genesisRevealPhase, parseRevealAtMs } from "@/lib/nft-generation/reveal/gate";

type Props = { slug: string; config: GenesisPassNftConfig };

function rarityLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/rarenft/i.test(host)) return "View on RareNFT";
    if (/moonrank/i.test(host)) return "View on MoonRank";
    if (/howrare/i.test(host)) return "View on HowRare";
  } catch {
    /* ignore */
  }
  return "Rarity & rankings";
}

export function GenesisGenerativeBanner({ slug, config }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const phase = genesisRevealPhase(now, config);
  const revealMs = parseRevealAtMs(config);
  const hasTraitPipeline = !!(config.traitConfigUri || config.traitConfig);
  const rarityUrl = config.rarityListingUrl?.trim();
  const hasPlaceholder = !!(config.placeholderImageUrl?.trim());

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

  const countdown =
    phase === "unrevealed" && revealMs != null ? (
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
    ) : null;

  if (!hasTraitPipeline && !rarityUrl && !revealMs && !hasPlaceholder) {
    return null;
  }

  const linkRow =
    rarityUrl && /^https:\/\//i.test(rarityUrl) ? (
      <div className="relative mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <a
          href={rarityUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/15"
        >
          {rarityLinkLabel(rarityUrl)} ↗
        </a>
        <span className="text-[10px] text-muted">Opens your rankings page — not used for mint math.</span>
      </div>
    ) : null;

  if (!hasTraitPipeline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 via-panel to-panel p-4 sm:p-5"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,245,158,0.18),transparent_55%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Genesis Pass extras</p>
            <p className="mt-1 text-sm font-medium text-white">
              {rarityUrl
                ? "Rarity listings are linked below."
                : revealMs
                  ? phase === "unrevealed"
                    ? "Reveal scheduled — add a trait-config URI in manage when your art pipeline is ready."
                    : "Reveal time has passed — configure trait-config.json for generative variants."
                  : hasPlaceholder
                    ? "Placeholder art is set; add trait-config when variants are ready."
                    : "Add trait variants (hosted trait-config) and optional rarity links in project settings."}
            </p>
            <p className="mt-1 text-xs text-muted">
              Cosmetic only — holder rewards and supply follow the on-chain program.
            </p>
          </div>
          {countdown}
        </div>
        {linkRow}
        <p className="relative mt-3 text-[10px] text-muted/80">Launch · {slug}</p>
      </motion.div>
    );
  }

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
            Variants come from your <span className="text-white/85">trait-config.json</span> weights and rules. Rarity
            links are display-only — claims and allocation stay on-chain.
          </p>
        </div>
        {countdown}
      </div>
      {linkRow}
      <p className="relative mt-3 text-[10px] text-muted/80">Launch · {slug}</p>
    </motion.div>
  );
}
