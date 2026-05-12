"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { explorerUrl } from "@/lib/solana/cluster-public";
import type { Collection } from "@/types/collection";

type Props = {
  collection: Collection;
  /** "full" = manage / post-deploy; "compact" = tighter for launch page */
  variant?: "full" | "compact";
};

function CopyAddr({ value, short }: { value: string; short?: boolean }) {
  const [ok, setOk] = useState(false);
  const show = short ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      window.setTimeout(() => setOk(false), 2000);
    } catch {
      /* ignore */
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="group inline-flex max-w-full items-center gap-2 text-left"
      title="Copy address"
    >
      <code className="break-all font-mono text-[11px] text-white/90 group-hover:text-accent">{show}</code>
      <span className="shrink-0 rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted group-hover:border-accent/40 group-hover:text-accent">
        {ok ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function LinkOut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

/**
 * Links for the SPL token + Genesis Pass collection + Alpha Vault so holders
 * can verify addresses (Jupiter, Solscan).
 */
export function DualMarketDiscoveryCard({ collection: c, variant = "full" }: Props) {
  const mint = c.tokenMint;
  const coll = c.coreCollection;
  const vault = c.alphaVault;
  if (!mint || !coll) return null;

  const sym = c.tokenSymbol ?? "TOKEN";
  const jupToken = `https://jup.ag/tokens/${mint}`;
  const jupSwap = `https://jup.ag/swap/So11111111111111111111111111111111111111112-${mint}`;
  const dexscreener = `https://dexscreener.com/solana/${mint}`;

  if (variant === "compact") {
    return (
      <div className="rounded-2xl border border-line/80 bg-panel/50 p-4 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Token + NFT + vault</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          <span className="text-white/85">${sym}</span> on aggregators once pools exist; Genesis Passes on NFT marketplaces.
          Primary mints go through the Alpha Vault on this site.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <LinkOut href={jupToken}>Jupiter · token</LinkOut>
          <LinkOut href={explorerUrl("address", mint)}>Solscan · {sym}</LinkOut>
          <LinkOut href={explorerUrl("address", coll)}>Solscan · collection</LinkOut>
          {vault ? <LinkOut href={explorerUrl("address", vault)}>Solscan · Alpha Vault</LinkOut> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/25 bg-gradient-to-b from-accent/[0.06] to-panel/60 p-5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Discovery checklist</p>
      <h3 className="mt-2 font-display text-base font-semibold text-white">
        Share authoritative mint, collection, and vault addresses
      </h3>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Primary liquidity is raised through your Meteora Alpha Vault. Jupiter and explorers index the{" "}
        <strong className="font-medium text-white/90">token mint</strong> once routers see pools; NFT venues index{" "}
        <strong className="font-medium text-white/90">Core collection + metadata</strong>. Pin the vault address for
        anyone verifying how mints fund the pool.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line/70 bg-black/25 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">${sym} (SPL)</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Share the mint so people can swap on Jupiter and track on Dexscreener after DAMM / router liquidity exists.
          </p>
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Mint</p>
              <CopyAddr value={mint} />
            </div>
            {vault ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Alpha Vault</p>
                <CopyAddr value={vault} short />
              </div>
            ) : null}
            {c.dammPool ? (
              <div title="Infrastructure reference only — not Anchor lifecycle.">
                <p className="text-[10px] uppercase tracking-wider text-muted">DAMM pool (infra ref)</p>
                <CopyAddr value={c.dammPool} short />
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-white/[0.06] pt-3">
            <LinkOut href={jupToken}>Jupiter · token page</LinkOut>
            <LinkOut href={jupSwap}>Jupiter · swap from SOL</LinkOut>
            <LinkOut href={dexscreener}>Dexscreener</LinkOut>
            <LinkOut href={explorerUrl("address", mint)}>Solscan · mint</LinkOut>
            {vault ? <LinkOut href={explorerUrl("address", vault)}>Solscan · vault</LinkOut> : null}
          </div>
        </div>

        <div className="rounded-xl border border-line/70 bg-black/25 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Genesis Pass (Metaplex Core)</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Secondary sales follow NFT indexers. Keep collection + item metadata on stable HTTPS; search this collection
            address on OpenSea, Tensor, or Magic Eden after the first mints land.
          </p>
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Core collection</p>
              <CopyAddr value={coll} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-white/[0.06] pt-3">
            <LinkOut href={explorerUrl("address", coll)}>Solscan · collection</LinkOut>
            <Link
              href={`/mint/${c.slug}`}
              className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
            >
              Primary mint · this site
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        Tip: ask moderators to pin <strong className="text-white/80">mint + collection + vault</strong>. Scammers often spoof tickers; only
        on-chain IDs are authoritative.
      </p>
    </div>
  );
}
