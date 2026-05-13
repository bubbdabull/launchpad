"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { useMemo, type ReactNode } from "react";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

import { getPublicRpcUrl } from "@/lib/solana/cluster-public";

import { MobileWalletBrowserHint } from "./auth/MobileWalletBrowserHint";
import { MobileWalletConnectRequiredHint } from "./auth/MobileWalletConnectRequiredHint";
import { PrivySessionSync } from "./auth/PrivySessionSync";
import { PrivyWalletBridge } from "./auth/PrivyWalletBridge";
import { SolanaMobileWalletRegister } from "./auth/SolanaMobileWalletRegister";
import { SmoothScroll } from "./layout/smooth-scroll";
import { QueryProvider } from "./providers/query-provider";

const PRIVY_ENABLED = process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_ACTIVE = PRIVY_ENABLED && Boolean(PRIVY_APP_ID);

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getPublicRpcUrl(), []);
  /** Privy’s `toSolanaWalletConnectors` listens on `@wallet-standard/app`; keep wallet-adapter above `PrivyProvider` so injected wallets register first. */
  const solanaWalletConnectors = useMemo(
    () => toSolanaWalletConnectors({ shouldAutoConnect: false }),
    [],
  );
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  const privyConfig = useMemo(() => {
    const wc = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
    return {
      // Omit when unset so Privy can use a WalletConnect project id from the
      // dashboard if configured; passing `undefined` explicitly can block that.
      ...(wc ? { walletConnectCloudProjectId: wc } : {}),
      // Email + social + (optional) wallet for crypto-natives. Wallet entry
      // here lets users link an existing Phantom/Solflare to a Privy
      // identity if they want — they can also bypass Privy entirely via
      // wallet-adapter's "Connect wallet" path.
      loginMethods: ["email", "google", "apple", "twitter", "wallet"],
      appearance: {
        theme: "dark",
        accentColor: "#9be7c4",
        walletChainType: "solana-only",
        showWalletLoginFirst: false,
      },
      embeddedWallets: {
        // `users-without-wallets`: email/social users get an embedded wallet;
        // users who sign in with Phantom already have a wallet, so Privy does
        // not create a second embedded one. Use `all-users` if you want to
        // prompt every account (including external-wallet logins) for a Privy
        // embedded wallet as well.
        solana: { createOnLogin: "users-without-wallets" },
      },
      externalWallets: {
        solana: { connectors: solanaWalletConnectors },
      },
    } as PrivyClientConfig;
  }, [solanaWalletConnectors]);

  const queryAndChildren = (
    <QueryProvider>
      <MobileWalletBrowserHint />
      <MobileWalletConnectRequiredHint />
      <SmoothScroll />
      {PRIVY_ACTIVE ? (
        <>
          <PrivySessionSync />
          <PrivyWalletBridge />
        </>
      ) : null}
      {children}
    </QueryProvider>
  );

  const solanaOuter = (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={!PRIVY_ACTIVE}>
        <SolanaMobileWalletRegister />
        <WalletModalProvider>
          {PRIVY_ACTIVE ? (
            <PrivyProvider appId={PRIVY_APP_ID!} config={privyConfig}>
              {queryAndChildren}
            </PrivyProvider>
          ) : (
            queryAndChildren
          )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );

  return solanaOuter;
}
