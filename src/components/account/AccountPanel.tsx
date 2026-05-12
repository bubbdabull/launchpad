"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet } from "@privy-io/react-auth/solana";

import { PrivyFundWalletButton } from "@/components/auth/PrivyFundWalletButton";
import {
  getPrivyBridgeState,
  reconnectPrivyBridge,
  subscribePrivyBridgeState,
  type PrivyBridgeState,
} from "@/components/auth/PrivyWalletBridge";
import {
  explorerUrl,
  getPublicCluster,
  getPublicRpcUrl,
} from "@/lib/solana/cluster-public";

const PRIVY_ENABLED =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

type Props = {
  /** Solana base58 address from the SIWS server session. */
  signedInAddress: string;
};

/**
 * The signed-in user's profile/account view. Shows their Solana address,
 * SOL balance, the email/social on file (if Privy), and lets them top up
 * with a card or export the embedded wallet's private key. Sign-out lives
 * here too — the WalletAuthButton in the header redirects here when signed
 * in, so this is the canonical "you're logged in" surface.
 *
 * Trading readiness lives here too: we surface whether the wallet is
 * linked to the app's signing layer (via PrivyWalletBridge → wallet-
 * adapter), and on devnet we expose a 1-SOL faucet button so testers can
 * fund a freshly-created embedded wallet without bouncing to a third-
 * party faucet.
 */
export function AccountPanel({ signedInAddress }: Props) {
  return PRIVY_ENABLED ? (
    <PrivyAccountPanel signedInAddress={signedInAddress} />
  ) : (
    <PlainAccountPanel signedInAddress={signedInAddress} />
  );
}

type TradingReadiness =
  | "ready"
  | "connecting"
  | "selecting"
  | "no-adapter"
  | "preparing"
  | "error";

type TradingDiagnosis = {
  status: TradingReadiness;
  matched: boolean;
  detail?: string;
};

function usePrivyBridgeState(): PrivyBridgeState {
  const [state, setState] = useState<PrivyBridgeState>(() =>
    getPrivyBridgeState(),
  );
  useEffect(() => {
    const unsub = subscribePrivyBridgeState(setState);
    return () => {
      unsub();
    };
  }, []);
  return state;
}

function useTradingReadiness(
  targetAddress: string,
  bridgeState?: PrivyBridgeState,
): TradingDiagnosis {
  const { connected, connecting, publicKey } = useWallet();
  const matched = !!publicKey && publicKey.toBase58() === targetAddress;

  if (connected && matched) return { status: "ready", matched: true };

  if (bridgeState) {
    if (bridgeState.kind === "connected" && bridgeState.address === targetAddress)
      return { status: "ready", matched: true };
    if (bridgeState.kind === "no-privy-adapter")
      return { status: "no-adapter", matched };
    if (bridgeState.kind === "selecting")
      return { status: "selecting", matched };
    if (bridgeState.kind === "connecting")
      return { status: "connecting", matched };
    if (bridgeState.kind === "error")
      return {
        status: "error",
        matched,
        detail: bridgeState.message,
      };
  }

  if (connecting) return { status: "connecting", matched };
  return { status: "preparing", matched };
}

function tradingReadinessText(diagnosis: TradingDiagnosis): {
  text: string;
  tone: "good" | "warn" | "muted" | "bad";
} {
  switch (diagnosis.status) {
    case "ready":
      return { text: "Ready to trade", tone: "good" };
    case "connecting":
      return { text: "Linking wallet to app…", tone: "warn" };
    case "selecting":
      return { text: "Linking wallet…", tone: "warn" };
    case "no-adapter":
      return {
        text: "Signing wallet not ready yet.",
        tone: "bad",
      };
    case "error":
      return {
        text: diagnosis.detail
          ? `Connect failed: ${diagnosis.detail}`
          : "Connect failed",
        tone: "bad",
      };
    default:
      return { text: "Preparing wallet…", tone: "muted" };
  }
}

function PrivyAccountPanel({ signedInAddress }: Props) {
  const { user, authenticated, ready: privyReady, logout: privyLogout } = usePrivy();
  const { exportWallet } = useExportWallet();
  const { disconnect } = useWallet();
  const router = useRouter();

  const cluster = getPublicCluster();
  const isDevnet = cluster === "devnet";

  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [airdropBusy, setAirdropBusy] = useState(false);
  const [airdropMessage, setAirdropMessage] = useState<string | null>(null);

  const bridgeState = usePrivyBridgeState();
  const trading = useTradingReadiness(signedInAddress, bridgeState);
  const tradingMessage = useMemo(
    () => tradingReadinessText(trading),
    [trading],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const conn = new Connection(getPublicRpcUrl(), "confirmed");
        const lamports = await conn.getBalance(new PublicKey(signedInAddress));
        if (!cancelled) setBalanceSol(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (!cancelled) setBalanceSol(null);
      }
    }
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [signedInAddress]);

  const email = user?.email?.address;
  const linkedSocials: string[] = [];
  if (user?.google?.email) linkedSocials.push(`Google · ${user.google.email}`);
  if (user?.twitter?.username) {
    linkedSocials.push(`X · ${user.twitter.username}`);
  }
  if (user?.apple?.email) linkedSocials.push(`Apple · ${user.apple.email}`);

  // Privy stamps every embedded wallet with walletClientType:"privy". An
  // external wallet linked through Privy (Phantom etc.) has a different
  // walletClientType, so this distinction is what tells us whether the
  // user can export a private key (only for embedded).
  const isEmbedded =
    user?.linkedAccounts?.some(
      (a) =>
        a.type === "wallet" &&
        a.chainType === "solana" &&
        a.walletClientType === "privy" &&
        a.address === signedInAddress
    ) ?? false;

  async function handleSignOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/privy/logout", { method: "POST" });
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
      try {
        await privyLogout();
      } catch {
        /* ignore */
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      await exportWallet({ address: signedInAddress });
    } catch {
      /* user closed the modal */
    }
  }

  async function handleAirdrop() {
    setAirdropMessage(null);
    setAirdropBusy(true);
    try {
      const conn = new Connection(getPublicRpcUrl(), "confirmed");
      const sig = await conn.requestAirdrop(
        new PublicKey(signedInAddress),
        LAMPORTS_PER_SOL,
      );
      await conn.confirmTransaction(sig, "confirmed");
      const lamports = await conn.getBalance(new PublicKey(signedInAddress));
      setBalanceSol(lamports / LAMPORTS_PER_SOL);
      setAirdropMessage("Funded with 1 devnet SOL.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAirdropMessage(
        msg.toLowerCase().includes("airdrop request limit")
          ? "Airdrop rate-limited. Try faucet.solana.com or wait a minute."
          : `Airdrop failed: ${msg}`,
      );
    } finally {
      setAirdropBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-panel/40 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Wallet"
            value={
              <a
                href={explorerUrl("address", signedInAddress)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-white underline-offset-2 hover:underline"
              >
                {signedInAddress}
              </a>
            }
          />
          <Field
            label="Cluster"
            value={
              <span className="text-xs text-white">
                {cluster === "mainnet-beta" ? "Mainnet" : "Devnet"}
              </span>
            }
          />
          <Field
            label="SOL balance"
            value={
              <span className="text-sm font-medium text-white">
                {balanceSol === null ? "—" : `${balanceSol.toFixed(4)} SOL`}
              </span>
            }
          />
          <Field
            label="Wallet type"
            value={
              <span className="text-xs text-white">
                {isEmbedded ? "Privy embedded (managed)" : "External Solana wallet"}
              </span>
            }
          />
          <Field
            label="Trading"
            value={
              <span
                className={
                  tradingMessage.tone === "good"
                    ? "text-xs text-emerald-300"
                    : tradingMessage.tone === "warn"
                    ? "text-xs text-amber-300"
                    : tradingMessage.tone === "bad"
                    ? "text-xs text-rose-300"
                    : "text-xs text-muted"
                }
              >
                {tradingMessage.text}
                {trading.status !== "ready" ? (
                  <button
                    type="button"
                    onClick={() => reconnectPrivyBridge()}
                    className="ml-2 underline-offset-2 hover:underline"
                  >
                    Reconnect
                  </button>
                ) : null}
              </span>
            }
          />
          {email ? (
            <Field
              label="Email"
              value={<span className="text-xs text-white">{email}</span>}
            />
          ) : null}
          {linkedSocials.length > 0 ? (
            <Field
              label="Linked"
              value={
                <span className="text-xs text-white">
                  {linkedSocials.join(" · ")}
                </span>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isDevnet ? (
          <button
            type="button"
            onClick={handleAirdrop}
            disabled={airdropBusy}
            className="rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-bg shadow-card hover:brightness-110 disabled:opacity-60"
          >
            {airdropBusy ? "Requesting airdrop…" : "Get 1 devnet SOL"}
          </button>
        ) : (
          <PrivyFundWalletButton variant="button" />
        )}
        {isEmbedded ? (
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-line bg-panel px-4 py-2.5 text-xs font-medium text-white hover:border-white/25"
          >
            Export private key
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(signedInAddress)}
          className="rounded-full border border-line bg-panel px-4 py-2.5 text-xs font-medium text-white hover:border-white/25"
        >
          Copy address
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="rounded-full border border-line bg-transparent px-4 py-2.5 text-xs font-medium text-muted hover:border-white/25 hover:text-white disabled:opacity-60"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {airdropMessage ? (
        <p className="text-xs text-muted">{airdropMessage}</p>
      ) : null}

      {trading.status !== "ready" ? (
        <p className="text-xs text-muted">
          We&apos;re linking your Privy wallet to the app so you can sign
          mints and trades. This usually takes a second after sign-in.
        </p>
      ) : null}

      {!privyReady ? (
        <p className="text-xs text-muted">Loading Privy session…</p>
      ) : !authenticated ? (
        <p className="text-xs text-rose-300">
          Privy session expired. Sign out and back in to refresh.
        </p>
      ) : null}
    </div>
  );
}

function PlainAccountPanel({ signedInAddress }: Props) {
  const { disconnect } = useWallet();
  const router = useRouter();
  const cluster = getPublicCluster();
  const isDevnet = cluster === "devnet";

  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [airdropBusy, setAirdropBusy] = useState(false);
  const [airdropMessage, setAirdropMessage] = useState<string | null>(null);

  const trading = useTradingReadiness(signedInAddress);
  const tradingMessage = useMemo(
    () => tradingReadinessText(trading),
    [trading],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const conn = new Connection(getPublicRpcUrl(), "confirmed");
        const lamports = await conn.getBalance(new PublicKey(signedInAddress));
        if (!cancelled) setBalanceSol(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (!cancelled) setBalanceSol(null);
      }
    }
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [signedInAddress]);

  async function handleSignOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/siws/logout", { method: "POST" });
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAirdrop() {
    setAirdropMessage(null);
    setAirdropBusy(true);
    try {
      const conn = new Connection(getPublicRpcUrl(), "confirmed");
      const sig = await conn.requestAirdrop(
        new PublicKey(signedInAddress),
        LAMPORTS_PER_SOL,
      );
      await conn.confirmTransaction(sig, "confirmed");
      const lamports = await conn.getBalance(new PublicKey(signedInAddress));
      setBalanceSol(lamports / LAMPORTS_PER_SOL);
      setAirdropMessage("Funded with 1 devnet SOL.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAirdropMessage(
        msg.toLowerCase().includes("airdrop request limit")
          ? "Airdrop rate-limited. Try faucet.solana.com or wait a minute."
          : `Airdrop failed: ${msg}`,
      );
    } finally {
      setAirdropBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-panel/40 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Wallet"
            value={
              <a
                href={explorerUrl("address", signedInAddress)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-white underline-offset-2 hover:underline"
              >
                {signedInAddress}
              </a>
            }
          />
          <Field
            label="Cluster"
            value={
              <span className="text-xs text-white">
                {cluster === "mainnet-beta" ? "Mainnet" : "Devnet"}
              </span>
            }
          />
          <Field
            label="SOL balance"
            value={
              <span className="text-sm font-medium text-white">
                {balanceSol === null ? "—" : `${balanceSol.toFixed(4)} SOL`}
              </span>
            }
          />
          <Field
            label="Trading"
            value={
              <span
                className={
                  tradingMessage.tone === "good"
                    ? "text-xs text-emerald-300"
                    : tradingMessage.tone === "warn"
                    ? "text-xs text-amber-300"
                    : tradingMessage.tone === "bad"
                    ? "text-xs text-rose-300"
                    : "text-xs text-muted"
                }
              >
                {tradingMessage.text}
              </span>
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isDevnet ? (
          <button
            type="button"
            onClick={handleAirdrop}
            disabled={airdropBusy}
            className="rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-bg shadow-card hover:brightness-110 disabled:opacity-60"
          >
            {airdropBusy ? "Requesting airdrop…" : "Get 1 devnet SOL"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(signedInAddress)}
          className="rounded-full border border-line bg-panel px-4 py-2.5 text-xs font-medium text-white hover:border-white/25"
        >
          Copy address
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="rounded-full border border-line bg-transparent px-4 py-2.5 text-xs font-medium text-muted hover:border-white/25 hover:text-white disabled:opacity-60"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {airdropMessage ? (
        <p className="text-xs text-muted">{airdropMessage}</p>
      ) : null}
    </div>
  );
}



function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">
        {label}
      </p>
      <div className="mt-1">{value}</div>
    </div>
  );
}
