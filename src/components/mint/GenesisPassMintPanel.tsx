"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { PrivyFundWalletButton } from "@/components/auth/PrivyFundWalletButton";
import { useConnectFlow } from "@/lib/auth/use-connect-flow";
import { buildAlphaVaultHybridMintTx } from "@/lib/launch/build-alpha-vault-hybrid-mint-tx";
import { relaxedGenesisMintWithoutLifecycle } from "@/lib/launch/genesis-mint-config";
import { canPublicMintGenesisPass } from "@/lib/launch/launch-on-chain";
import { getPlatformMintFeeLamports } from "@/lib/launch/platform-fees";
import { sendAlphaVaultFinalFillAfterLastMint } from "@/lib/launch/send-alpha-vault-final-fill";
import { explorerUrl } from "@/lib/solana/cluster-public";
import { sendVersionedTransactionPreferRpc } from "@/lib/solana/send-legacy-tx-prefer-rpc";
import type { Collection } from "@/types/collection";

type Props = { collection: Collection; anchorMintActive?: boolean };

type Phase =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "signing" }
  | { kind: "confirming"; sig: string; finalizing?: boolean }
  | { kind: "done"; sig: string; asset: string }
  | { kind: "error"; message: string };

function lamportsToSolLabel(lamports: bigint): string {
  return `${(Number(lamports) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`;
}

export function GenesisPassMintPanel({ collection: c, anchorMintActive = false }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const openConnect = useConnectFlow();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const remaining = Math.max(0, c.supply - c.minted);
  const status = c.status;
  const isReady = !!c.coreCollection && !!c.alphaVault;
  const mintAllowed = canPublicMintGenesisPass(c) && anchorMintActive;
  const platformFee = getPlatformMintFeeLamports();
  const showHypeCta = mintAllowed && anchorMintActive && remaining > 0;

  const mintPriceLamports = c.mintPriceLamports ?? BigInt(0);
  const totalPays = mintPriceLamports + platformFee;

  const buttonLabel = useMemo(() => {
    if (phase.kind === "preparing") return "Building transaction…";
    if (phase.kind === "signing") return "Confirm in wallet…";
    if (phase.kind === "confirming" && phase.finalizing) return "Vault fill tx (confirm if prompted)…";
    if (phase.kind === "confirming") return "Confirming on Solana…";
    if (phase.kind === "done") return "Minted ✓";
    if (!wallet.connected) return "Connect · get in queue";
    if (status === "sold_out" || remaining === 0) return "Sold out · you missed the print";
    if (!isReady) return "Vault wiring… creator deploying";
    if (!anchorMintActive) return "Mint locked · MINT_ACTIVE soon";
    if (!mintAllowed) return "Mint unavailable";
    return "Mint pass · send it";
  }, [phase, wallet.connected, status, remaining, isReady, mintAllowed, anchorMintActive]);

  async function handleMint() {
    setPhase({ kind: "idle" });

    if (!wallet.connected || !wallet.publicKey) {
      openConnect();
      return;
    }
    if (!mintAllowed) {
      setPhase({
        kind: "error",
        message:
          "Mint is not available (sold out, off-chain wiring incomplete, or Anchor lifecycle is still before MINT_ACTIVE).",
      });
      return;
    }
    if (!isReady) {
      setPhase({
        kind: "error",
        message:
          "This launch hasn’t finished its on-chain setup. The creator must link a Meteora Alpha Vault and a Metaplex Core Genesis Pass collection before mints work.",
      });
      return;
    }

    try {
      setPhase({ kind: "preparing" });

      const mintOrder = c.minted + 1;
      const walletAdapter = wallet as unknown as Parameters<typeof buildAlphaVaultHybridMintTx>[1]["wallet"];
      const launch = c as Collection & { slug: string };

      const { tx, asset } = await buildAlphaVaultHybridMintTx(connection, {
        user: wallet.publicKey,
        wallet: walletAdapter,
        launch,
        mintOrder,
      });

      setPhase({ kind: "signing" });

      if (!wallet.sendTransaction && typeof wallet.signTransaction !== "function") {
        throw new Error("Wallet does not support sendTransaction or signTransaction.");
      }
      const sig = await sendVersionedTransactionPreferRpc(wallet, connection, tx);

      setPhase({ kind: "confirming", sig });

      await connection.confirmTransaction(sig, "confirmed");

      if (mintOrder === c.supply && c.alphaVault && wallet.publicKey) {
        setPhase({ kind: "confirming", sig, finalizing: true });
        try {
          await sendAlphaVaultFinalFillAfterLastMint(
            connection,
            wallet as unknown as Parameters<typeof sendAlphaVaultFinalFillAfterLastMint>[1],
            new PublicKey(c.alphaVault),
          );
        } catch {
          /* Anyone can crank fill later; mint already succeeded. */
        }
      }

      // Fire-and-forget: record the referral if the lp_ref cookie is set.
      // We don't block the success UI on this — the referral row is purely
      // tracking, the mint itself already paid out fees on-chain.
      void fetch("/api/referrals/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: c.slug,
          mintSignature: sig,
          referredWallet: wallet.publicKey.toBase58(),
        }),
      }).catch(() => {
        /* ignore */
      });

      setPhase({ kind: "done", sig, asset: asset.toBase58() });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Mint failed." });
    }
  }

  return (
    <aside
      className={`space-y-4 rounded-2xl border bg-[#121214]/90 p-6 shadow-card sm:p-7 ${
        showHypeCta
          ? "border-accent/35 shadow-[0_0_32px_rgba(34,245,158,0.12)] ring-1 ring-accent/20"
          : "border-white/[0.1]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Mint panel</p>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted">
          Solana
        </span>
      </div>

      {showHypeCta ? (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-100/95">
          {remaining <= 50 && remaining > 0
            ? `${remaining.toLocaleString()} passes remaining.`
            : `${remaining.toLocaleString()} passes left at this price.`}
        </p>
      ) : null}

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Mint price</p>
        </div>
        <p className="font-display text-3xl font-semibold text-white">
          {mintPriceLamports > BigInt(0) ? lamportsToSolLabel(mintPriceLamports) : c.priceLabel}
        </p>
        {mintPriceLamports > BigInt(0) ? (
          <p className="text-[11px] text-muted">
            + {lamportsToSolLabel(platformFee)} platform fee · total{" "}
            <span className="text-white">{lamportsToSolLabel(totalPays)}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-panel/40 p-4 text-xs">
        <p className="text-[10px] uppercase tracking-wider text-muted">Transaction preview (human-readable)</p>
        <ul className="space-y-1.5 text-white/80">
          <li>1. Your quote hits the Meteora Alpha Vault — same numbers as the card.</li>
          <li>2. Core mints your Genesis Pass #{c.minted + 1} — your on-chain receipt.</li>
          <li>3. Pass stores vault route + order — provable, not vibes.</li>
          <li className="text-white/65">
            Token liquidity is a separate leg; you&apos;re buying the pass + primary raise lane, not a promise DM.
          </li>
          {remaining === 1 ? (
            <li>4. After mint confirms, client submits Meteora vault fill (second wallet approval if shown).</li>
          ) : null}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-line bg-panel/40 p-3">
          <p className="uppercase tracking-wider text-muted">Printed</p>
          <p className="mt-1 text-sm font-medium text-white">
            {c.minted.toLocaleString()} / {c.supply.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel/40 p-3">
          <p className="uppercase tracking-wider text-muted">Left</p>
          <p className="mt-1 text-sm font-medium text-white">{remaining.toLocaleString()}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleMint}
        disabled={
          phase.kind === "preparing" ||
          phase.kind === "signing" ||
          phase.kind === "confirming" ||
          phase.kind === "done" ||
          !mintAllowed ||
          remaining === 0 ||
          (wallet.connected && !isReady)
        }
        className={`inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
          showHypeCta ? "animate-cm-cta-pulse shadow-[0_0_24px_rgba(34,245,158,0.25)]" : ""
        }`}
      >
        {buttonLabel}
      </button>

      {remaining > 0 && isReady && !anchorMintActive ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-100/95">
          <p className="font-medium text-amber-50">Mint gate: Anchor MINT_ACTIVE</p>
          <p className="mt-1.5 text-amber-100/90">
            Vault and Core collection are linked, but the on-chain controller must reach{" "}
            <span className="text-white/90">MINT_ACTIVE</span> before hybrid mints record participation. The creator
            finishes this from the{" "}
            <Link href={`/launch/${c.slug}#deploy-on-chain`} className="underline underline-offset-2 hover:text-white">
              launch page
            </Link>{" "}
            deploy panel (Anchor step).
          </p>
          <p className="mt-2 text-amber-100/85">
            <Link href={`/launch/${c.slug}#deploy-on-chain`} className="underline underline-offset-2 hover:text-white">
              Open launch deploy
            </Link>
          </p>
        </div>
      ) : null}

      {remaining > 0 && !isReady ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-100/95">
          <p className="font-medium text-amber-50">Why mint is disabled</p>
          <p className="mt-1.5 text-amber-100/90">
            The app needs both a{" "}
            <span className="text-white/90">Metaplex Core collection</span> and a{" "}
            <span className="text-white/90">Meteora Alpha Vault</span> address on the launch record to build the mint
            transaction.
          </p>
          <p className="mt-2 text-amber-100/85">
            Creator: finish{" "}
            <Link href={`/launch/${c.slug}`} className="underline underline-offset-2 hover:text-white">
              Deploy on-chain
            </Link>{" "}
            on the{" "}
            <Link href={`/launch/${c.slug}`} className="underline underline-offset-2 hover:text-white">
              launch page
            </Link>{" "}
            and confirm Supabase has{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">core_collection</code> and{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">alpha_vault</code>.
          </p>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {phase.kind === "confirming" || phase.kind === "signing" || phase.kind === "preparing" ? (
          <motion.div
            key="inflight"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-[11px] text-accent"
          >
            {phase.kind === "preparing" ? "Compiling vault + Core instructions…" : null}
            {phase.kind === "signing" ? "Wallet signature requested — review accounts carefully." : null}
            {phase.kind === "confirming" ? "Broadcasting · waiting for Solana confirmation…" : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {phase.kind === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className="space-y-3 overflow-hidden rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-400/15 via-black/50 to-accent/10 p-4 text-xs text-emerald-50 shadow-[0_0_40px_rgba(34,245,158,0.12)] ring-1 ring-emerald-400/25"
          >
            <p className="font-display text-sm font-semibold text-white">Genesis reveal · you&apos;re early</p>
            <p>
              Minted Genesis Pass + deposited into the Alpha Vault in a single transaction. Metadata rarity is whatever
              Metaplex + your indexer show — not decided here.
            </p>
            <p className="text-[11px] text-emerald-100/85">
              Participation receipt: on-chain asset + vault deposit. Share the tx, tag the creator, flex the pass.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={explorerUrl("tx", phase.sig)} target="_blank" rel="noreferrer" className="font-mono underline">
                View transaction
              </a>
              <a href={explorerUrl("address", phase.asset)} target="_blank" rel="noreferrer" className="font-mono underline">
                View NFT
              </a>
              <Link href={`/launch/${c.slug}`} className="font-mono text-white underline">
                Creator mission
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {phase.kind === "error" && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">{phase.message}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {relaxedGenesisMintWithoutLifecycle() ? (
          <p className="text-[11px] leading-relaxed text-amber-100/80">
            Relaxed mint gate: you can print while Anchor is still catching up; participation records once the launch
            reaches <span className="text-white/90">MINT_ACTIVE</span>.
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted">
            Holders ride this launch&apos;s fee story on DAMM / Alpha Vault rails — details on the project page. Only bet
            what you can torch.
          </p>
        )}
        <PrivyFundWalletButton
          suggestedSol={Number(totalPays) / 1_000_000_000}
        />
      </div>
    </aside>
  );
}
