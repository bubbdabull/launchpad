"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import { useWallets as usePrivySolanaWallets } from "@privy-io/react-auth/solana";

const PRIVY_ENABLED =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export type PrivySyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "synced" }
  | { kind: "waiting-for-wallet" }
  | { kind: "error"; message: string };

let lastReportedState: PrivySyncState = { kind: "idle" };
const subscribers = new Set<(s: PrivySyncState) => void>();

export function getPrivySyncState(): PrivySyncState {
  return lastReportedState;
}

export function subscribePrivySyncState(cb: (s: PrivySyncState) => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function emit(state: PrivySyncState) {
  lastReportedState = state;
  for (const cb of subscribers) cb(state);
}

export function PrivySessionSync() {
  if (!PRIVY_ENABLED) return null;
  return <PrivySessionSyncInner />;
}

/**
 * Watches Privy auth state and keeps our server-side `lp_wallet_session`
 * cookie in lockstep with it.
 *
 * Critical detail for new-user signups: when a user logs in with email or
 * social, Privy flips `authenticated = true` BEFORE the embedded Solana
 * wallet is finished being provisioned. If we sync at that moment the
 * server can't find a Solana address on the user → 409 → we'd be stuck on
 * "Finishing sign-in…" forever. So we explicitly wait for at least one
 * Solana wallet entry from `useWallets()` (Privy's Solana hook reports
 * provisioning status reliably), and retry transient failures with
 * exponential backoff.
 *
 * On Privy logout we tear down our cookie via /api/auth/privy/logout and
 * `router.refresh()` so server components re-render in the logged-out
 * state.
 */
function PrivySessionSyncInner() {
  const router = useRouter();
  const { authenticated, ready, user, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const {
    wallets: solanaWallets,
    ready: solanaWalletsReady,
  } = usePrivySolanaWallets();

  // Surface sync state so other components can render diagnostics.
  const [, setLocalState] = useState<PrivySyncState>({ kind: "idle" });
  function pushState(s: PrivySyncState) {
    setLocalState(s);
    emit(s);
  }

  // `retryTick` is bumped whenever we want the sync effect to re-run for
  // a reason that isn't visible in Privy's hook deps (e.g. transient API
  // failure, server-side wallet indexing lag). It's part of the effect
  // dependency array so bumping it deterministically re-fires the sync.
  const [retryTick, setRetryTick] = useState(0);

  const lastSyncedUserRef = useRef<string | null>(null);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const retryAttemptRef = useRef<number>(0);
  const retryTimerRef = useRef<number | null>(null);

  // ---- Tear down our cookie on Privy logout.
  useEffect(() => {
    if (!ready) return;
    if (authenticated && user) return;
    if (lastSyncedUserRef.current === null) return;
    lastSyncedUserRef.current = null;
    lastSyncedTokenRef.current = null;
    retryAttemptRef.current = 0;
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    void fetch("/api/auth/privy/logout", { method: "POST" }).then(() => {
      pushState({ kind: "idle" });
      router.refresh();
    });
  }, [ready, authenticated, user, router]);

  // ---- Sync our cookie when Privy is ready, authenticated, and a Solana wallet exists.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !user) return;

    // If wallets aren't ready yet OR none has been provisioned, wait. The
    // effect re-fires when `solanaWalletsReady` flips or `solanaWallets`
    // gains an entry.
    if (!solanaWalletsReady) return;
    if (solanaWallets.length === 0) {
      pushState({ kind: "waiting-for-wallet" });
      return;
    }

    if (inFlightRef.current) return;
    if (
      lastSyncedUserRef.current === user.id &&
      lastSyncedTokenRef.current === identityToken
    ) {
      return;
    }

    inFlightRef.current = true;
    pushState({ kind: "syncing" });

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          pushState({
            kind: "error",
            message: "Couldn't read Privy access token.",
          });
          return;
        }
        const res = await fetch("/api/auth/privy/login", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          lastSyncedUserRef.current = user.id;
          lastSyncedTokenRef.current = identityToken ?? null;
          retryAttemptRef.current = 0;
          pushState({ kind: "synced" });
          router.refresh();
          return;
        }

        const text = await res.text().catch(() => "");
        if (res.status === 409) {
          // Wallet not seen by the server yet — schedule a retry. The
          // outer dep on `solanaWallets` will normally trigger this for
          // us, but if Privy already had a wallet when we hit 409 it's
          // an indexing lag and we need to back off.
          scheduleRetry();
          pushState({ kind: "waiting-for-wallet" });
          return;
        }

        if (res.status === 401 || res.status === 502) {
          // Transient — retry a few times.
          if (retryAttemptRef.current < 3) {
            scheduleRetry();
            return;
          }
        }

        const message =
          tryParseError(text) ??
          `Sign-in failed (${res.status}). Try signing out and back in.`;
        pushState({ kind: "error", message });
        console.warn("[PrivySessionSync] login sync failed", res.status, text);
      } catch (err) {
        if (retryAttemptRef.current < 3) {
          scheduleRetry();
          return;
        }
        const message =
          err instanceof Error ? err.message : "Sign-in failed.";
        pushState({ kind: "error", message });
        console.warn("[PrivySessionSync] login sync error", err);
      } finally {
        inFlightRef.current = false;
      }
    })();

    function scheduleRetry() {
      const attempt = retryAttemptRef.current++;
      const delay = Math.min(8000, 500 * 2 ** attempt);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        lastSyncedUserRef.current = null;
        lastSyncedTokenRef.current = null;
        retryTimerRef.current = null;
        setRetryTick((t) => t + 1);
      }, delay);
    }
  }, [
    ready,
    authenticated,
    user,
    identityToken,
    solanaWalletsReady,
    solanaWallets,
    getAccessToken,
    router,
    retryTick,
  ]);

  return null;
}

function tryParseError(text: string): string | null {
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { error?: string };
    return typeof j.error === "string" ? j.error : null;
  } catch {
    return null;
  }
}
