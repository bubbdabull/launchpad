"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { useSiwsSignIn } from "@/lib/auth/use-siws-sign-in";
import {
  getPrivySyncState,
  subscribePrivySyncState,
  type PrivySyncState,
} from "@/components/auth/PrivySessionSync";

function usePrivySyncState(): PrivySyncState {
  const [state, setState] = useState<PrivySyncState>(() => getPrivySyncState());
  useEffect(() => {
    const unsub = subscribePrivySyncState(setState);
    return () => {
      unsub();
    };
  }, []);
  return state;
}

const PRIVY_ENABLED =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

type Props = {
  signedInAddress?: string | null;
};

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletAuthButton(props: Props) {
  return PRIVY_ENABLED ? (
    <PrivyAuthButton {...props} />
  ) : (
    <WalletAdapterFallbackButton {...props} />
  );
}

/**
 * Privy-only auth button. This is the production flow.
 *
 * Privy is the sole identity provider. There is **no SIWS message signing
 * step** — `PrivySessionSync` watches `usePrivy().authenticated` and posts
 * the verified Privy access token to /api/auth/privy/login, which sets our
 * `lp_wallet_session` cookie. Server components then re-render with the
 * `signedInAddress` prop populated and this button collapses to an
 * "Account" link.
 *
 * Click flow:
 *   - No session → "Sign in" → opens Privy modal
 *   - Privy authenticated, our cookie not yet written → "Finishing
 *     sign-in…" (the sync component is in flight)
 *   - Signed in → "Account · ABcd…XyZw" (link to /account) + "Sign out"
 */
function PrivyAuthButton({ signedInAddress }: Props) {
  const router = useRouter();
  const { authenticated: privyAuthenticated, logout: privyLogout } = usePrivy();
  const { login: privyLogin } = useLogin({
    onError: (err) => {
      console.warn("[WalletAuthButton] Privy login error:", err);
    },
  });
  const { disconnect } = useWallet();
  const [busy, setBusy] = useState(false);
  const sync = usePrivySyncState();

  const isSignedIn = Boolean(signedInAddress);

  const buttonLabel = useMemo(() => {
    if (busy) return "Signing out…";
    if (sync.kind === "error") return "Sign-in failed — sign out";
    if (privyAuthenticated && !isSignedIn) {
      if (sync.kind === "waiting-for-wallet") return "Creating wallet…";
      return "Finishing sign-in…";
    }
    return "Sign in";
  }, [busy, privyAuthenticated, isSignedIn, sync]);

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
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  function handleLogin() {
    privyLogin();
  }

  // If Privy authenticated but our session never finalised AND we hit a
  // hard error, the click should sign out so the user can retry cleanly.
  const stuckOnError =
    privyAuthenticated && !isSignedIn && sync.kind === "error";
  const onClick = stuckOnError ? handleSignOut : handleLogin;
  const errorMessage = sync.kind === "error" ? sync.message : null;

  return (
    <div className="flex items-center gap-2">
      {isSignedIn && signedInAddress ? (
        <>
          <Link
            href="/account"
            className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-white hover:border-white/25"
          >
            {`Account · ${shortAddress(signedInAddress)}`}
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={busy}
            className="rounded-full border border-line bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-muted hover:border-white/25 hover:text-white disabled:opacity-60"
            title="Sign out"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-white hover:border-white/25 disabled:opacity-60"
          >
            {buttonLabel}
          </button>
          {errorMessage ? (
            <span className="hidden text-[11px] text-rose-300 lg:inline">
              {errorMessage}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Dev/testing fallback used only when Privy is disabled
 * (`NEXT_PUBLIC_PRIVY_ENABLED=false`). Production traffic should never hit
 * this path. Kept so devs can iterate on the launchpad without a Privy app.
 *
 * This path keeps the SIWS message-signing flow because there's no Privy
 * identity to fall back on — the wallet's signature *is* the auth.
 */
function WalletAdapterFallbackButton({ signedInAddress }: Props) {
  const router = useRouter();
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { status, error, runSignIn } = useSiwsSignIn();
  const [busyOverride, setBusyOverride] = useState<"idle" | "busy">("idle");

  const isSignedIn = Boolean(signedInAddress);
  const isBusy = status === "busy" || busyOverride === "busy";

  const buttonLabel = useMemo(() => {
    if (isBusy) return "Signing…";
    if (isSignedIn && signedInAddress)
      return `Account · ${shortAddress(signedInAddress)}`;
    if (connected && publicKey) return "Sign in";
    return "Connect wallet";
  }, [isBusy, isSignedIn, signedInAddress, connected, publicKey]);

  async function handleClick() {
    if (isSignedIn) {
      setBusyOverride("busy");
      await fetch("/api/auth/siws/logout", { method: "POST" });
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
      setBusyOverride("idle");
      router.refresh();
      return;
    }

    if (!connected || !publicKey || !signMessage) {
      setVisible(true);
      return;
    }

    await runSignIn();
  }

  return (
    <div className="flex items-center gap-2">
      {isSignedIn && signedInAddress ? (
        <>
          <Link
            href="/account"
            className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-white hover:border-white/25"
          >
            {`Account · ${shortAddress(signedInAddress)}`}
          </Link>
          <button
            type="button"
            onClick={handleClick}
            disabled={isBusy}
            className="rounded-full border border-line bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-muted hover:border-white/25 hover:text-white disabled:opacity-60"
            title="Sign out"
          >
            Sign out
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isBusy}
          className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-white hover:border-white/25 disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      )}
      {error ? (
        <span className="hidden text-xs text-rose-300 lg:inline">{error}</span>
      ) : null}
    </div>
  );
}
