"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const PRIVY_ENABLED =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

/**
 * Single entry point for "user needs to connect a wallet."
 *
 * - With Privy enabled (default): opens the Privy modal. Email, social, and
 *   external wallets (Phantom, Solflare, Backpack, Jupiter, etc.) all live
 *   inside it. After Privy authenticates, `PrivySessionSync` exchanges the
 *   Privy access token for our `lp_wallet_session` cookie (not SIWS). For
 *   mint/deploy/trade, `PrivyWalletBridge` connects wallet-adapter to Privy's
 *   Wallet Standard wallet.
 *
 * - With Privy disabled (dev/testing only): falls back to the legacy
 *   wallet-adapter modal (Phantom + Solflare directly).
 *
 * All UI surfaces ("Connect wallet to mint", "Sign in to claim", etc.)
 * should call this hook instead of touching wallet-adapter's modal directly.
 * That keeps the auth surface single-source-of-truth.
 */
export function useConnectFlow() {
  return PRIVY_ENABLED ? usePrivyConnectFlow() : useWalletAdapterFallbackFlow();
}

function usePrivyConnectFlow() {
  const { login } = usePrivy();
  return useCallback(() => {
    login();
  }, [login]);
}

function useWalletAdapterFallbackFlow() {
  const { setVisible } = useWalletModal();
  return useCallback(() => {
    setVisible(true);
  }, [setVisible]);
}
