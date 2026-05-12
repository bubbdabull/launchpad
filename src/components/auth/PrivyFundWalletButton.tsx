"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as usePrivySolanaWallets,
  useFundWallet,
} from "@privy-io/react-auth/solana";

const PRIVY_ENABLED =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

type Props = {
  /** Optional amount in SOL the user is being prompted to add (e.g. mint price + fee). */
  suggestedSol?: number;
  /** Variant — `link` is a plain text link, `button` is a styled button. */
  variant?: "link" | "button";
  className?: string;
};

/**
 * "Add SOL with card" CTA. Renders nothing unless:
 *   - Privy is enabled
 *   - the user is authenticated through Privy
 *   - the user has at least one Privy embedded Solana wallet
 *
 * Wallet-adapter (Phantom/Solflare) users see nothing — they fund externally.
 * For Privy users, clicking opens Privy's funding modal which routes through
 * MoonPay / Coinbase Onramp / etc. depending on what the dashboard has on.
 */
export function PrivyFundWalletButton({
  suggestedSol,
  variant = "link",
  className,
}: Props) {
  if (!PRIVY_ENABLED) return null;
  return (
    <PrivyFundWalletButtonInner
      suggestedSol={suggestedSol}
      variant={variant}
      className={className}
    />
  );
}

function PrivyFundWalletButtonInner({ suggestedSol, variant, className }: Props) {
  const { authenticated, ready: privyReady } = usePrivy();
  const { ready: walletsReady, wallets } = usePrivySolanaWallets();
  const { fundWallet } = useFundWallet();
  const [busy, setBusy] = useState(false);

  if (!privyReady || !authenticated) return null;
  if (!walletsReady) return null;

  const target = wallets[0];
  if (!target) return null;

  async function handleClick() {
    if (!target) return;
    try {
      setBusy(true);
      await fundWallet({
        address: target.address,
        options: suggestedSol
          ? {
              amount: String(Math.max(suggestedSol, 0.05)),
            }
          : undefined,
      });
    } catch {
      /* user closed the modal; nothing to do */
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? "Opening…" : "Add SOL with card";

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          className ??
          "inline-flex w-full items-center justify-center rounded-full border border-line bg-panel px-4 py-2.5 text-xs font-medium text-white hover:border-white/25 disabled:opacity-60"
        }
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        "text-[11px] font-medium text-accent underline-offset-2 hover:underline disabled:opacity-60"
      }
    >
      {label} →
    </button>
  );
}
