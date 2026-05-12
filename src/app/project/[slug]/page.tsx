import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DualMarketDiscoveryCard } from "@/components/launch/DualMarketDiscoveryCard";
import { ProjectPageBlocks } from "@/components/project/ProjectPageBlocks";
import { getWalletSession } from "@/lib/auth/session";
import { getCollectionBySlug } from "@/lib/data/launchpad";
import { pct } from "@/lib/format";
import { resolveProjectPageTheme } from "@/lib/launch/project-page";

type PageProps = { params: Promise<{ slug: string }> };

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  const session = await getWalletSession();
  const isCreator = !!c.creatorWallet && session?.address === c.creatorWallet;

  const theme = resolveProjectPageTheme(c);
  const headline = c.projectHeadline || c.name;
  const subhead = c.projectSubhead || c.tagline;

  const showDescription = !c.projectPage?.hideDefaultDescription;
  const showStats = !c.projectPage?.hideDefaultStats;

  // Inline style for the accent color override. We swap the platform CSS
  // variables that the page uses (--accent / --accent-2). Cards / buttons
  // inside this page subtree pick the override up automatically.
  const themeStyle = theme.accent
    ? ({
        ["--accent" as string]: theme.accent,
        ["--accent-2" as string]: theme.accent,
      } as React.CSSProperties)
    : undefined;

  return (
    <div style={themeStyle}>
      <ProjectHero c={c} headline={headline} subhead={subhead} layout={theme.heroLayout} />

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:py-16">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-gradient-to-r from-panel/80 to-panel/40 p-4">
          <p className="text-sm text-white/75">
            Catch the tape: trade page for deploy + economics, mint page when the controller flips live.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/launch/${c.slug}`}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-white hover:border-white/30"
            >
              {`Trade · $${(c.tokenSymbol ?? "TOKEN").toUpperCase()}`}
            </Link>
            <Link
              href={`/mint/${c.slug}`}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink shadow-glow hover:brightness-110"
            >
              Mint pass
            </Link>
          </div>
        </div>

        {isCreator ? (
          <p className="text-center text-xs text-muted">
            Creator tools:{" "}
            <Link href={`/project/${c.slug}/manage`} className="text-accent underline-offset-2 hover:underline">
              Manage launch settings
            </Link>
          </p>
        ) : null}

        {c.coreCollection && c.tokenMint ? (
          <DualMarketDiscoveryCard collection={c} variant="compact" />
        ) : null}

        {/*
         * Default content + stats grid. Both can be hidden via the page
         * builder (hideDefaultDescription / hideDefaultStats) so creators
         * can take full control when their custom blocks already cover
         * the same ground.
         */}
        {(showDescription || showStats) && (
          <div className="grid gap-10 sm:grid-cols-[1.1fr_0.9fr]">
            {showDescription ? (
              <div className="space-y-6">
                <p className="text-sm leading-relaxed text-muted">{c.description}</p>
                {c.utilities.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">Utilities</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.utilities.map((u) => (
                        <span
                          key={u}
                          className="rounded-full bg-white/5 px-3 py-1 text-xs text-white ring-1 ring-white/10"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div />
            )}

            {showStats ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                {[
                  ["Supply", c.supply.toLocaleString()],
                  ["Minted", `${c.minted.toLocaleString()} (${pct(c.minted, c.supply)}%)`],
                  ["Mint price", c.priceLabel],
                  ["Phase", c.phase],
                  ["Status", c.status],
                  ["Creator", c.creatorDisplayName ?? c.creator],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-line bg-panel/60 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
                    <p className="mt-2 text-sm font-medium text-white">{v}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/*
         * Custom blocks the creator added through the page editor. Render
         * after the default content so the order is: hero → quick CTAs →
         * description/stats → custom story → footer.
         */}
        {c.projectPage && c.projectPage.blocks.length > 0 ? (
          <ProjectPageBlocks blocks={c.projectPage.blocks} />
        ) : null}
      </div>
    </div>
  );
}

function ProjectHero({
  c,
  headline,
  subhead,
  layout,
}: {
  c: import("@/types/collection").Collection;
  headline: string;
  subhead: string;
  layout: "classic" | "minimal" | "split";
}) {
  const navButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/#launches"
        className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white backdrop-blur hover:border-white/30"
      >
        ← All launches
      </Link>
    </div>
  );

  if (layout === "minimal") {
    return (
      <div className="border-b border-line/60 bg-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-ink">
              <Image src={c.logoUrl} alt="" fill sizes="64px" className="object-cover" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Project · Solana
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {headline}
              </h1>
              {subhead ? (
                <p className="mt-1 max-w-2xl text-sm text-muted">{subhead}</p>
              ) : null}
            </div>
          </div>
          {navButtons}
        </div>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="border-b border-line/60">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-[1fr_1fr] sm:px-6 lg:gap-10">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-panel">
            <Image src={c.bannerUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          </div>
          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-line bg-ink">
                <Image src={c.logoUrl} alt="" fill sizes="56px" className="object-cover" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Project · Solana
              </p>
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {headline}
            </h1>
            {subhead ? (
              <p className="max-w-prose text-sm leading-relaxed text-muted">{subhead}</p>
            ) : null}
            <div className="pt-2">{navButtons}</div>
          </div>
        </div>
      </div>
    );
  }

  // "classic" — current default.
  return (
    <div className="relative h-[320px] w-full sm:h-[380px]">
      <Image src={c.bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-2xl ring-1 ring-black/60 sm:h-28 sm:w-28">
              <Image src={c.logoUrl} alt="" fill className="object-cover" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Project · Solana
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {headline}
              </h1>
              {subhead ? (
                <p className="mt-2 max-w-2xl text-sm text-muted">{subhead}</p>
              ) : null}
            </div>
          </div>
          {navButtons}
        </div>
      </div>
    </div>
  );
}
