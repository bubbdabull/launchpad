import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LaunchMissionShell } from "@/components/launch/LaunchMissionShell";
import { DualMarketDiscoveryCard } from "@/components/launch/DualMarketDiscoveryCard";
import { DeployOnChainPanel } from "@/components/launch/DeployOnChainPanel";
import { MintTiersPanel } from "@/components/launch/MintTiersPanel";
import { PassYieldPanel } from "@/components/launch/PassYieldPanel";
import { RewardHoldersPanel } from "@/components/launch/RewardHoldersPanel";
import { getWalletSession } from "@/lib/auth/session";
import { getCreatorProfile } from "@/lib/creators/profiles";
import { getCollectionBySlug } from "@/lib/data/launchpad";
import { fetchAnchorMintActive } from "@/lib/launch/anchor-lifecycle-server";
import { launchMintSetupComplete } from "@/lib/launch/launch-on-chain";

type PageProps = { params: Promise<{ slug: string }> };

export default async function LaunchPage({ params }: PageProps) {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  const symbol = c.tokenSymbol ?? "TOKEN";

  const session = await getWalletSession();
  const isCreator = !!c.creatorWallet && session?.address === c.creatorWallet;
  const anchorMintActive = await fetchAnchorMintActive(c);
  const dbLaunchReady = launchMintSetupComplete(c);
  const deployWorkComplete = dbLaunchReady && anchorMintActive;
  const showDeployPanel = isCreator && !deployWorkComplete;
  const creatorProfile = c.creatorWallet ? await getCreatorProfile(c.creatorWallet) : null;

  const tokenMintSummary = !c.tokenMint
    ? "Set during on-chain deploy"
    : anchorMintActive
      ? `${c.tokenMint.slice(0, 6)}…${c.tokenMint.slice(-4)}`
      : `${c.tokenMint.slice(0, 6)}…${c.tokenMint.slice(-4)} · mint gate pending`;

  return (
    <div>
      <div className="relative h-[280px] w-full sm:h-[340px]">
        <Image src={c.bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(34,245,158,0.1),transparent_50%)]" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-2xl ring-1 ring-black/60 sm:h-24 sm:w-24">
                <Image src={c.logoUrl} alt="" fill className="object-cover" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                  Live launch · {`$${symbol}`}
                </p>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {c.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted">{c.tagline}</p>
                {c.creatorWallet ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>By</span>
                    <Link
                      href={`/creator/${c.creatorWallet}`}
                      className="text-white/90 underline-offset-2 hover:text-accent hover:underline"
                    >
                      {creatorProfile?.displayName ?? c.creator}
                    </Link>
                    {creatorProfile?.verified ? (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                        ✓ Verified
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 self-start sm:flex-row sm:items-center sm:self-end">
              {anchorMintActive ? (
                <Link
                  href={`/mint/${c.slug}`}
                  className="animate-cm-cta-pulse rounded-full bg-accent px-5 py-2.5 text-center text-sm font-bold text-ink shadow-[0_0_32px_rgba(34,245,158,0.28)] transition hover:brightness-110"
                >
                  Mint now
                </Link>
              ) : (
                <span
                  className="rounded-full border border-amber-400/35 bg-amber-400/10 px-5 py-2.5 text-center text-sm font-semibold text-amber-100/95"
                  title="Public mint opens after the creator finishes deploy through Anchor MINT_ACTIVE."
                >
                  Mint locked · deploy in progress
                </span>
              )}
              <Link
                href={`/project/${c.slug}`}
                className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-center text-sm text-white backdrop-blur hover:border-white/30"
              >
                Story
              </Link>
              {isCreator ? (
                <Link
                  href={`/project/${c.slug}/manage`}
                  className="rounded-full border border-accent/40 bg-accent/15 px-4 py-2 text-center text-sm font-medium text-accent backdrop-blur hover:bg-accent/25"
                >
                  Manage
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <LaunchMissionShell collection={c} creatorProfile={creatorProfile}>
        <div className="space-y-8 lg:py-2">
        {showDeployPanel ? <DeployOnChainPanel collection={c} /> : null}
        <MintTiersPanel collection={c} />
        <PassYieldPanel collection={c} />
        {isCreator && deployWorkComplete ? <RewardHoldersPanel collection={c} /> : null}

        {(c.creatorVestingSupplyPct ?? 0) > 0 ? (
          <VestingSchedule collection={c} />
        ) : null}

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">About</h2>
          <p className="text-sm leading-relaxed text-muted">{c.description}</p>
        </section>

        <section className="rounded-2xl border border-accent/25 bg-gradient-to-b from-accent/[0.07] to-panel/80 p-6 shadow-glow">
          <p className="text-[10px] uppercase tracking-wider text-accent">Raise</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white">Alpha Vault and Genesis Pass</h2>
          <p className="mt-2 text-sm text-muted">
            Mints deposit quote into the Meteora Alpha Vault at the price shown on the card. When the vault completes,
            liquidity can move to DAMM v2 for trading.
          </p>
          <p className="mt-3 text-xs text-white/80">
            Ticker · <span className="font-mono font-semibold text-accent">{`$${symbol}`}</span>
            {c.alphaVault ? (
              <span className="mt-2 block font-mono text-[11px] text-white/70">
                Vault · {c.alphaVault.slice(0, 8)}…{c.alphaVault.slice(-6)}
              </span>
            ) : null}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            ["Ticker", `$${symbol}`],
            ["Status", c.status === "live" ? "Live" : c.status === "sold_out" ? "Sold out" : "Warming up"],
            ["Minted", `${c.minted.toLocaleString()} / ${c.supply.toLocaleString()}`],
            ["24h volume", c.volume24h ?? "—"],
            ["Vault", c.alphaVault ? `${c.alphaVault.slice(0, 6)}…${c.alphaVault.slice(-4)}` : "Not wired"],
            ["Token mint", tokenMintSummary],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-panel/60 p-4 ring-1 ring-white/[0.04]">
              <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
              <p className="mt-2 break-all text-sm font-semibold text-white">{v}</p>
            </div>
          ))}
        </section>

        {deployWorkComplete && c.tokenMint && c.coreCollection ? (
          <DualMarketDiscoveryCard collection={c} variant="compact" />
        ) : null}
        </div>
      </LaunchMissionShell>
    </div>
  );
}

function VestingSchedule({ collection: c }: { collection: import("@/types/collection").Collection }) {
  const supplyPct = c.creatorVestingSupplyPct ?? 0;
  const cliff = c.creatorVestingCliffMonths ?? 0;
  const period = c.creatorVestingPeriodMonths ?? 12;
  const holderPct = c.tokenHolderRewardPct ?? 0;

  const totalLocked = Math.floor((1_000_000_000 * supplyPct) / 100);
  const perWave = period > 0 ? Math.floor(totalLocked / period) : 0;
  const toCreator = Math.floor((perWave * (100 - holderPct)) / 100);
  const toHolders = perWave - toCreator;
  const symbol = c.tokenSymbol ?? "TOKEN";
  const ticker = `$${symbol}`;

  return (
    <section className="rounded-2xl border border-line bg-panel/40 p-6">
      <p className="text-[10px] uppercase tracking-wider text-accent">Creator vesting</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-white">
        {supplyPct}% reserved · linear over {period} months
        {cliff > 0 ? ` · ${cliff}-month cliff` : ""}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        After your vault and token setup complete{cliff > 0 ? ` and a ${cliff}-month cliff` : ""},{" "}
        {totalLocked.toLocaleString()} {ticker} unlocks in {period} monthly waves. Each wave: ~{perWave.toLocaleString()}{" "}
        {ticker} → creator wallet
        {holderPct > 0 ? `, of which the creator commits ${holderPct}% to Genesis Pass holders.` : "."}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-ink p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted">Per-wave to creator</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">
            ~{toCreator.toLocaleString()} {ticker}
          </p>
          <p className="text-[11px] text-muted">{100 - holderPct}% of each wave</p>
        </div>
        <div className="rounded-xl border border-line bg-ink p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted">Per-wave to holders</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">
            ~{toHolders.toLocaleString()} {ticker}
          </p>
          <p className="text-[11px] text-muted">
            {holderPct === 0 ? "Creator opted to keep 100%" : `${holderPct}% pro-rata to current holders`}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-ink p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted">Lifetime locked</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">
            {totalLocked.toLocaleString()} {ticker}
          </p>
          <p className="text-[11px] text-muted">{supplyPct}% of total supply</p>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-muted">
        Vested tokens accrue in a Jupiter Locker linked to the creator&apos;s wallet (
        <a className="underline" href="https://lock.jup.ag/" target="_blank" rel="noreferrer">
          lock.jup.ag
        </a>
        ). The creator claims each wave there, then optionally airdrops the holders&apos; share via the launch&apos;s reward
        panel.
      </p>
    </section>
  );
}
