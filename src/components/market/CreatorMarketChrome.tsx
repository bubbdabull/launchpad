"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import Balancer from "react-wrap-balancer";

import { ActivityTicker, type TickerItem } from "@/components/ui/activity-ticker";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { GlassCard } from "@/components/ui/glass-card";
import { LiveBadge } from "@/components/ui/live-badge";
import { MotionSection } from "@/components/ui/motion-section";
import { NeonButton } from "@/components/ui/neon-button";
import { RarityFrame } from "@/components/ui/rarity-frame";
import { WalletStateChip } from "@/components/ui/wallet-state-chip";
import { CosmeticSignalStrip } from "@/components/gamification/cosmetic-signal-strip";
import { LiveActivityFeed } from "@/components/live/live-activity-feed";
import { MarketParticipationMarquee } from "@/components/live/market-participation-marquee";
import { HotLaunchChip } from "@/components/market/hot-launch-chip";
import { pct } from "@/lib/format";
import { UI_NON_AUTHORITY_DISCLAIMER } from "@/lib/ui/architecture-ui";
import type { Collection } from "@/types/collection";
import type { PlatformStats } from "@/types/platform";

import type { ReactNode } from "react";

type Props = {
  featured: Collection;
  collections: Collection[];
  platformStats: PlatformStats;
  children: ReactNode;
};

function buildTicker(collections: Collection[], featured: Collection): TickerItem[] {
  const top = [...collections].sort((a, b) => (a.trendingRank ?? 999) - (b.trendingRank ?? 999)).slice(0, 8);
  const lines: TickerItem[] = top.map((c) => ({
    id: `t-${c.slug}`,
    text: `${c.name} · ${c.minted.toLocaleString()}/${c.supply.toLocaleString()} minted · ${c.status}`,
  }));
  lines.unshift({
    id: "spot",
    text: `${featured.name}${featured.tokenSymbol ? ` · $${featured.tokenSymbol}` : ""} · featured`,
  });
  return lines;
}

function marqueeLines(collections: Collection[]) {
  return collections.slice(0, 14).map((c) => ({
    id: `mq-${c.slug}`,
    label: `${c.name} · ${(c.mintsLastHour ?? 0).toLocaleString()} mints/h · ${pct(c.minted, c.supply)}% filled`,
  }));
}

function VisualCoinCard({
  c,
  href,
  mintHref,
  hot,
}: {
  c: Collection;
  href: string;
  mintHref?: string;
  hot?: boolean;
}) {
  const fill = pct(c.minted, c.supply);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition duration-300 hover:border-accent/30 hover:shadow-elev-1">
      <div className="relative aspect-[5/4] w-full">
        <Link href={href} className="absolute inset-0 z-10" aria-label={c.name} />
        <Image
          src={c.bannerUrl}
          alt=""
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          sizes="(max-width:768px) 45vw, 200px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
          <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/15 bg-black">
            <Image src={c.logoUrl} alt="" fill className="object-cover" sizes="44px" />
          </div>
          <HotLaunchChip active={!!hot} />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-3">
          <p className="truncate font-display text-sm font-semibold text-white">{c.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {fill}% · {c.priceLabel}
            {(c.mintsLastHour ?? 0) > 0 ? (
              <span className="ml-2 text-accent/90">+{(c.mintsLastHour ?? 0).toLocaleString()}/h</span>
            ) : null}
          </p>
        </div>
      </div>
      {mintHref ? (
        <div className="relative z-20 border-t border-line p-2">
          <Link
            href={mintHref}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-semibold text-ink active:scale-[0.99]"
          >
            Mint
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function CreatorMarketChrome({ featured, collections, platformStats, children }: Props) {
  const ticker = buildTicker(collections, featured);
  const mq = marqueeLines(collections);
  const trending = [...collections]
    .filter((c) => c.status === "live")
    .sort((a, b) => (a.trendingRank ?? 999) - (b.trendingRank ?? 999))
    .slice(0, 6);
  const fresh = [...collections]
    .filter((c) => c.launchedAt)
    .sort((a, b) => (b.launchedAt ?? "").localeCompare(a.launchedAt ?? ""))
    .slice(0, 6);
  const highSignal = [...collections]
    .filter((c) => c.creatorVerified || (c.holderCount ?? 0) > 0)
    .sort((a, b) => (b.holderCount ?? 0) - (a.holderCount ?? 0))
    .slice(0, 4);
  const genesisShowcase = [...collections]
    .filter((c) => c.status === "live" || c.status === "sold_out")
    .sort((a, b) => b.minted / Math.max(b.supply, 1) - a.minted / Math.max(a.supply, 1))
    .slice(0, 3);
  const flex = [...collections].sort(
    (a, b) => b.minted / Math.max(b.supply, 1) - a.minted / Math.max(a.supply, 1),
  )[0];

  const featuredHot = (featured.mintsLastHour ?? 0) >= 6 || (featured.trendingRank ?? 99) <= 2;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 cm-grid-bg opacity-[0.2]" />
      <section className="relative mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative mx-auto h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-elev-glow sm:mx-0 sm:h-24 sm:w-24">
              <Image src={featured.logoUrl} alt="" fill className="object-cover" sizes="96px" priority />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-accent/90">
                Solana creator market
              </p>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 font-premium text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                <Balancer>
                  Live launches. <span className="cm-neon-text">Instant mints.</span>{" "}
                  <span className="text-white/90">Full-send energy.</span>
                </Balancer>
              </motion.h1>
              <p className="mt-3 max-w-xl text-sm text-muted">
                <Balancer>
                  Battlefield discovery, Genesis Pass flex, and read-only market tape. {UI_NON_AUTHORITY_DISCLAIMER}
                </Balancer>
              </p>
              <div className="mt-3 flex justify-center sm:justify-start">
                <CosmeticSignalStrip earlySupporter streakDays={3} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:max-w-md sm:items-end">
            <WalletStateChip />
            <ActivityTicker items={ticker} className="w-full" />
          </div>
        </div>

        <div className="mt-6">
          <MarketParticipationMarquee lines={mq} />
        </div>

        <div className="mt-8">
          <GlassCard glow="neon" className="overflow-hidden p-0" hoverLift>
            <div className="flex flex-col lg:flex-row">
              <div className="relative aspect-[16/10] w-full lg:aspect-auto lg:min-h-[280px] lg:w-1/2">
                <Image
                  src={featured.bannerUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:1024px) 100vw, 50vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent lg:bg-gradient-to-r" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  {featured.status === "live" ? <LiveBadge /> : null}
                  <HotLaunchChip active={featuredHot} />
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-4 p-6 sm:p-8">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-muted">Hero market</p>
                <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{featured.name}</h2>
                <p className="line-clamp-2 text-sm text-muted">{featured.tagline}</p>
                <div className="flex flex-wrap gap-2">
                  <NeonButton href={`/mint/${featured.slug}`}>Mint now</NeonButton>
                  <NeonButton href={`/launch/${featured.slug}`} variant="ghost">
                    Mission control
                  </NeonButton>
                  <NeonButton href="/create" variant="ghost">
                    Deploy
                  </NeonButton>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Live launches", value: platformStats.launchesLive },
            { label: "Passes minted", value: platformStats.totalMinted },
            { label: "Listed supply", value: platformStats.totalSupply },
          ].map((row) => (
            <GlassCard key={row.label} glow="none" className="py-5">
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted">{row.label}</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                <AnimatedCounter value={row.value} />
              </p>
            </GlassCard>
          ))}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <MotionSection>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">Trending now</h3>
                <p className="text-xs text-muted">Velocity + fill% (cached mirror)</p>
              </div>
              <Link href="#launches" className="min-h-[44px] text-sm font-medium text-accent hover:underline sm:min-h-0">
                All launches
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {trending.map((c) => (
                <VisualCoinCard
                  key={c.slug}
                  c={c}
                  href={`/launch/${c.slug}`}
                  mintHref={`/mint/${c.slug}`}
                  hot={(c.mintsLastHour ?? 0) >= 4 || (c.trendingRank ?? 99) <= 2}
                />
              ))}
            </div>
          </MotionSection>
          <MotionSection>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">Just launched</h3>
                <p className="text-xs text-muted">Fresh drops · countdowns on cards</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fresh.map((c) => (
                <VisualCoinCard key={c.slug} c={c} href={`/mint/${c.slug}`} />
              ))}
            </div>
          </MotionSection>
        </div>

        {highSignal.length ? (
          <MotionSection className="mt-12">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="font-display text-lg font-semibold text-white">High signal</h3>
              <p className="text-xs text-muted">Sorted for discovery—not who gets paid.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {highSignal.map((c) => (
                <GlassCard key={c.slug} glow="violet" className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10">
                      <Image src={c.logoUrl} alt="" fill className="object-cover" sizes="40px" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-[11px] text-muted">
                        {(c.holderCount ?? 0).toLocaleString()} holders
                        {c.creatorVerified ? <span className="text-emerald-300"> · verified</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <NeonButton href={`/launch/${c.slug}`} variant="ghost">
                      Intel
                    </NeonButton>
                    <NeonButton href={`/mint/${c.slug}`} variant="primary">
                      Mint
                    </NeonButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          </MotionSection>
        ) : null}

        {genesisShowcase.length ? (
          <MotionSection className="mt-12">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="font-display text-lg font-semibold text-white">Genesis flex</h3>
              <p className="text-xs text-muted">Passes leading the print — cosmetic frames</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {genesisShowcase.map((c) => (
                <RarityFrame key={c.slug} tier="genesis">
                  <div className="flex items-center gap-3 p-4">
                    <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10">
                      <Image src={c.logoUrl} alt="" fill className="object-cover" sizes="56px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-[11px] text-muted">{pct(c.minted, c.supply)}% filled</p>
                      <Link href={`/mint/${c.slug}`} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
                        Enter mint →
                      </Link>
                    </div>
                  </div>
                </RarityFrame>
              ))}
            </div>
          </MotionSection>
        ) : null}

        {flex ? (
          <MotionSection className="mt-10">
            <GlassCard glow="neon" className="flex flex-col gap-4 overflow-hidden p-0 sm:flex-row sm:items-stretch">
              <div className="relative aspect-[2/1] w-full sm:aspect-auto sm:w-44 sm:min-h-[130px]">
                <Image src={flex.bannerUrl} alt="" fill className="object-cover" sizes="180px" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink/90 sm:bg-gradient-to-l" />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:pr-6">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10">
                    <Image src={flex.logoUrl} alt="" fill className="object-cover" sizes="48px" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Top momentum</p>
                    <p className="font-display text-lg font-semibold text-white">{flex.name}</p>
                  </div>
                </div>
                <NeonButton href={`/mint/${flex.slug}`}>Mint</NeonButton>
              </div>
            </GlassCard>
          </MotionSection>
        ) : null}

        <div className="mt-12 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <LiveActivityFeed collections={collections} className="h-full min-h-[320px]" />
          </div>
          <GlassCard glow="mint" className="lg:col-span-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Participation network</p>
            <p className="mt-2 font-display text-lg font-semibold text-white">You are the liquidity culture layer</p>
            <p className="mt-2 text-sm text-muted">
              Wallets, passes, and vaults settle on Solana. This surface animates live mirrors so you can move fast — always
              verify balances and PDAs yourself.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-white/75">
              <p>RPC: read · TX: build + sign · Rewards: never computed here</p>
            </div>
          </GlassCard>
        </div>
      </section>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </div>
  );
}
