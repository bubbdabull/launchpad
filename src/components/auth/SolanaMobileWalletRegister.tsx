"use client";

import { useEffect } from "react";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { SOLANA_DEVNET_CHAIN, SOLANA_MAINNET_CHAIN } from "@solana/wallet-standard-chains";

import { getPublicCluster } from "@/lib/solana/cluster-public";

const MIN_PNG_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" as const;

/**
 * Registers Solana Mobile Wallet Adapter with the Wallet Standard registry so
 * Privy + `@wallet-standard/app` can reach wallet apps from mobile Chrome
 * (association / local wallet discovery). Safe no-op on unsupported browsers.
 */
export function SolanaMobileWalletRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cluster = getPublicCluster();
    const chains =
      cluster === "mainnet-beta"
        ? ([SOLANA_MAINNET_CHAIN] as const)
        : ([SOLANA_DEVNET_CHAIN] as const);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || window.location.origin;

    try {
      registerMwa({
        appIdentity: {
          name: "Creator Launchpad",
          uri: appUrl,
          icon: MIN_PNG_ICON,
        },
        authorizationCache: createDefaultAuthorizationCache(),
        chains: [...chains],
        chainSelector: createDefaultChainSelector(),
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      });
    } catch (e) {
      console.warn("[SolanaMobileWalletRegister] registerMwa failed:", e);
    }
  }, []);

  return null;
}
