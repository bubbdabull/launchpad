"use client";

import { useEffect, useState } from "react";

import { isMobileDeviceUserAgent } from "@/lib/browser/in-app-browser";

const PRIVY_ON =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
const WC_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim(),
);

const REOWN_CLOUD = "https://cloud.reown.com";

/**
 * Privy’s Solana external-wallet path uses WalletConnect on phones (no browser
 * extension). If `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is unset, Phantom /
 * Solflare login throws inside Privy (“WalletConnect Cloud Project ID is
 * required”). Surface that for operators and suggest email sign-in meanwhile.
 */
export function MobileWalletConnectRequiredHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!PRIVY_ON || WC_CONFIGURED) return;
    setShow(isMobileDeviceUserAgent(navigator.userAgent));
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[99] border-b border-sky-500/30 bg-sky-950/95 px-3 py-2.5 text-center text-[12px] leading-snug text-sky-50 shadow-md backdrop-blur-sm sm:text-[13px]"
    >
      <p className="mx-auto max-w-2xl">
        <span className="font-semibold text-white">Wallet sign-in on this device</span> needs a
        Reown (WalletConnect) Cloud project id in{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code>
        . Until then, use <span className="font-medium text-white">email or social sign-in</span>{" "}
        (you get an embedded Solana wallet), or open the dashboard:{" "}
        <a
          href={REOWN_CLOUD}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
        >
          {REOWN_CLOUD}
        </a>
        .
      </p>
  </div>
  );
}
