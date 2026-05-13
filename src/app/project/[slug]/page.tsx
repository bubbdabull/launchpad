import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DualMarketDiscoveryCard } from "@/components/launch/DualMarketDiscoveryCard";
import { getWalletSession } from "@/lib/auth/session";
import { getCollectionBySlug } from "@/lib/data/launchpad";
import { pct } from "@/lib/format";
import type { TokenSocialLinks } from "@/lib/launch/token-social";
import { resolveProjectPageTheme } from "@/lib/launch/project-page";
import type { Collection } from "@/types/collection";

type PageProps = { params: Promise<{ slug: string }> };

const SOCIAL_LABELS: { key: keyof TokenSocialLinks; label: string }[] = [
  { key: "website", label: "Website" },
  { key: "twitter", label: "X / Twitter" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
];

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  const session = await getWalletSession();
  const isCreator = !!c.creatorWallet && session?.address === c.creatorWallet;

  const theme = resolveProjectPageTheme(c);
  const headline = c.projectHeadline || c.name;
  const subhead = c.projectSubhead || c.tagline;

  const mintPct = c.supply > 0 ? Math.min(100, Math.round((100 * c.minted) / c.supply)) : 0;
  const gallery = (c.nftGalleryUrls ?? []).filter(Boolean);
  const social = c.tokenSocialLinks ?? {};
  const socialEntries = SOCIAL_LABELS.map(({ key, label }) => {
    const href = social[key];
    return href ? { label, href } : null;
  }).filter((x): x is { label: string; href: string } => x != null);

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
            Deploy and trade on the launch page; mint the Genesis Pass when the drop is live.
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
              Mint
            </Link>
          </div>
        </div>

        {isCreator ? (
          <p className="text-center text-xs text-muted">
            Creator:{" "}
            <Link href={`/project/${c.slug}/manage`} className="text-accent underline-offset-2 hover:underline">
              Manage launch
            </Link>{" "}
            (metadata and visibility — the public project story is set when you create the launch).
          </p>
        ) : null}

        <MintProgressCard collection={c} mintPct={mintPct} />

        {socialEntries.length > 0 ? (
          <div className="rounded-2xl border border-line bg-panel/40 p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted">Links</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {socialEntries.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-line bg-ink/40 px-4 py-2 text-sm text-white transition hover:border-accent/40 hover:text-accent"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {c.coreCollection && c.tokenMint ? (
          <DualMarketDiscoveryCard collection={c} variant="compact" />
        ) : null}

        {gallery.length > 0 ? (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Collection art</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((url) => (
                <div
                  key={url}
                  className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-panel"
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="(max-width:1024px) 50vw, 33vw" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-10 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">About</p>
            <p className="text-sm leading-relaxed text-muted">{c.description}</p>
            {c.utilities.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Notes</p>
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
            ) : null}
          </div>

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
        </div>
      </div>
    </div>
  );
}

function MintProgressCard({ collection, mintPct }: { collection: Collection; mintPct: number }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/50 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Mint progress</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">
            {collection.minted.toLocaleString()}{" "}
            <span className="text-base font-normal text-muted">/ {collection.supply.toLocaleString()}</span>
          </p>
        </div>
        <Link
          href={`/mint/${collection.slug}`}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink shadow-glow hover:brightness-110"
        >
          Go to mint
        </Link>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/80">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${mintPct}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-xs text-muted">{mintPct}% minted</p>
    </div>
  );
}

function ProjectHero({
  c,
  headline,
  subhead,
  layout,
}: {
  c: Collection;
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
