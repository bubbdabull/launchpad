import Image from "next/image";
import Link from "next/link";

import type { Collection } from "@/types/collection";

function spotlightLabel(c: Collection) {
  if (c.status === "live") return "On the board · mint live";
  if (c.status === "upcoming") return "Warming up · first prints soon";
  return "Printed out · sold through";
}

export function LaunchHero({ featured }: { featured: Collection }) {
  const c = featured;
  const tokenLabel = c.tokenSymbol ? `$${c.tokenSymbol}` : "Token";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-panel shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
      <div className="relative min-h-[min(78vh,820px)] w-full lg:min-h-[560px]">
        <Image src={c.bannerUrl} alt="" fill priority className="object-cover object-center" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/30 lg:bg-gradient-to-r lg:from-ink lg:via-ink/88 lg:to-ink/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,255,0,0.08),transparent_55%)]" />

        <div className="relative z-10 mx-auto flex h-full min-h-[min(78vh,820px)] max-w-7xl flex-col justify-end gap-10 px-6 pb-12 pt-28 sm:px-10 sm:pb-14 sm:pt-32 lg:min-h-[560px] lg:flex-row lg:items-end lg:justify-between lg:pb-16">
          <div className="max-w-2xl space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/90">
              Solana · JPEG meets ticker · vault-backed raises
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Drop your NFT. Name your coin. Let the crowd feel the tape.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              One fair pass price, one live vault, one shot for collectors to ride the raise with you. Pair a Metaplex
              Core Genesis Pass with a token story that clears on-chain — then chase volume on DAMM when the pool
              graduates.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/create"
                className="animate-cm-cta-pulse inline-flex items-center justify-center rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-ink shadow-[0_0_40px_rgba(200,255,0,0.22)] transition hover:brightness-110"
              >
                Ship a launch
              </Link>
              <Link
                href="#launches"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                Hunt the board
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                Creator dashboard
              </Link>
            </div>
          </div>

          <div className="w-full max-w-md shrink-0 rounded-2xl border border-white/10 bg-ink/55 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent/90">{spotlightLabel(c)}</p>
            <div className="mt-4 flex items-start gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 ring-1 ring-black/40 sm:h-[72px] sm:w-[72px]">
                <Image src={c.logoUrl} alt="" fill className="object-cover" sizes="72px" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">{c.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-white/55">{c.tagline}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/45">Pass price</p>
                <p className="mt-1 font-display text-lg text-white">{c.priceLabel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/45">Pass minted</p>
                <p className="mt-1 font-display text-lg text-white">
                  {c.minted.toLocaleString()}
                  <span className="text-sm font-normal text-white/45"> / {c.supply.toLocaleString()}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                style={{ width: `${Math.min(100, (100 * c.minted) / Math.max(1, c.supply))}%` }}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href={`/mint/${c.slug}`}
                className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-full bg-white px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-white/90"
              >
                Snipe pass
              </Link>
              <Link
                href={`/launch/${c.slug}`}
                className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:border-white/30"
              >
                Open tape · {tokenLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
