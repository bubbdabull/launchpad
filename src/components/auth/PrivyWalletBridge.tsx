"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as usePrivySolanaWallets } from "@privy-io/react-auth/solana";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { StandardWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";

import { pickPrimaryPrivySolanaWallet } from "@/lib/auth/privy-primary-solana-wallet";

/**
 * Bridges Privy authentication into the existing wallet-adapter flow so
 * that components calling `useWallet().signTransaction(...)` (mint,
 * deploy, vault/DAMM flows, claim, reward-holders) automatically use the
 * user's Privy-linked Solana account (embedded or external) without
 * per-component refactors.
 *
 * Privy exposes linked Solana accounts as Wallet Standard wallets; we
 * register the active one with `@wallet-standard/app` so wallet-adapter
 * can wrap it in a `StandardWalletAdapter`, then select and connect it.
 *
 * Two-effect state machine: Effect 1 selects the Privy adapter, Effect 2
 * connects once React has propagated the selection. Effect 3 tears down
 * on Privy logout.
 *
 * The bridge also publishes its current state to a tiny module-level
 * store so other components (the AccountPanel "Trading" status, a manual
 * "Reconnect" button, etc.) can subscribe and render diagnostics.
 *
 * Privy's Solana SDK exposes each linked account as a Wallet Standard
 * `standardWallet` (embedded is often named "Privy"; external Phantom/Solflare
 * keep their wallet names). Those wallets are not auto-registered with
 * `@wallet-standard/app`, so we register the active one here. Selection must
 * match by **wallet object reference** (`StandardWalletAdapter.wallet ===
 * standardWallet`), not by adapter display name — otherwise external-wallet
 * logins never find an adapter and Trading shows "adapter not found".
 */
function isManagedStandardAdapter(
  adapter: WalletAdapter | undefined,
  standardWallet: Wallet | null,
): boolean {
  return (
    !!adapter &&
    !!standardWallet &&
    adapter instanceof StandardWalletAdapter &&
    adapter.wallet === standardWallet
  );
}

export type PrivyBridgeState =
  | { kind: "idle" }
  | { kind: "waiting-for-privy" }
  | { kind: "no-privy-adapter" }
  | { kind: "selecting" }
  | { kind: "connecting" }
  | { kind: "connected"; address: string }
  | { kind: "error"; message: string };

let lastReportedState: PrivyBridgeState = { kind: "idle" };
const subscribers = new Set<(s: PrivyBridgeState) => void>();
let manualReconnectFn: (() => void) | null = null;

export function getPrivyBridgeState(): PrivyBridgeState {
  return lastReportedState;
}

export function subscribePrivyBridgeState(
  cb: (s: PrivyBridgeState) => void,
) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function reconnectPrivyBridge() {
  manualReconnectFn?.();
}

function emit(state: PrivyBridgeState) {
  lastReportedState = state;
  for (const cb of subscribers) cb(state);
}

/** Don't flash "adapter missing" while Wallet Standard + React catch up (ms). */
const ADAPTER_GRACE_MS = 2400;
/** Poll for StandardWalletAdapter after register; caps backoff (ms). */
const ADAPTER_POLL_BASE_MS = 48;
const ADAPTER_POLL_MAX_MS = 420;

export function PrivyWalletBridge() {
  const { authenticated, ready: privyReady } = usePrivy();
  const { ready: walletsReady, wallets: privyWallets } =
    usePrivySolanaWallets();
  const {
    wallets: adapterWallets,
    select,
    wallet,
    connect,
    connecting,
    connected,
    disconnect,
  } = useWallet();

  const primaryEntry = useMemo(
    () => pickPrimaryPrivySolanaWallet(privyWallets),
    [privyWallets],
  );
  const targetAddress = primaryEntry?.address ?? null;
  const targetStandardWallet = primaryEntry?.standardWallet ?? null;
  const managedStandardRef = useRef<Wallet | null>(null);
  const attemptedAddressRef = useRef<string | null>(null);
  const adapterPollGenRef = useRef(0);
  const adapterPollAttemptRef = useRef(0);
  /** When we began waiting for Privy Solana + adapter (for grace UI). */
  const linkWaitStartedAtRef = useRef<number | null>(null);
  const [reconnectTick, setReconnectTick] = useState(0);

  const reconnect = useCallback(() => {
    attemptedAddressRef.current = null;
    adapterPollAttemptRef.current = 0;
    linkWaitStartedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : null;
    setReconnectTick((t) => t + 1);
  }, []);

  useEffect(() => {
    manualReconnectFn = reconnect;
    return () => {
      if (manualReconnectFn === reconnect) manualReconnectFn = null;
    };
  }, [reconnect]);

  useEffect(() => {
    if (targetStandardWallet) managedStandardRef.current = targetStandardWallet;
  }, [targetStandardWallet]);

  // New session / new linked account → allow a fresh connect attempt.
  useEffect(() => {
    attemptedAddressRef.current = null;
    adapterPollAttemptRef.current = 0;
    if (authenticated && targetAddress && targetStandardWallet) {
      linkWaitStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : null;
    } else {
      linkWaitStartedAtRef.current = null;
    }
  }, [authenticated, targetAddress, targetStandardWallet]);

  // Layout: register before paint so wallet-adapter's standard list is warm
  // for the first select/connect pass (smoother than effect-only).
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!privyReady || !walletsReady || !authenticated || !targetStandardWallet)
      return;
    const unregister = getWallets().register(targetStandardWallet);
    queueMicrotask(() => {
      setReconnectTick((t) => t + 1);
    });
    return unregister;
  }, [privyReady, walletsReady, authenticated, targetStandardWallet]);

  // If wallet-adapter still has a legacy injected adapter selected (e.g. from
  // localStorage), the select effect bails forever. Drop it so we can select
  // the StandardWalletAdapter that wraps Privy's `standardWallet`.
  useEffect(() => {
    if (!privyReady || !walletsReady || !authenticated || !targetAddress)
      return;
    if (!wallet?.adapter) return;
    if (isManagedStandardAdapter(wallet.adapter, targetStandardWallet)) return;
    void disconnect().catch(() => {
      /* ignore */
    });
  }, [
    privyReady,
    walletsReady,
    authenticated,
    targetAddress,
    targetStandardWallet,
    wallet,
    disconnect,
  ]);

  // ---- Publish state for diagnostics.
  useEffect(() => {
    if (!privyReady || !walletsReady) {
      emit({ kind: "waiting-for-privy" });
      return;
    }
    if (!authenticated || !targetAddress) {
      emit({ kind: "idle" });
      return;
    }
    if (
      connected &&
      isManagedStandardAdapter(wallet?.adapter, targetStandardWallet) &&
      wallet?.adapter.publicKey?.toBase58() === targetAddress
    ) {
      emit({ kind: "connected", address: targetAddress });
      return;
    }
    if (connecting) {
      emit({ kind: "connecting" });
      return;
    }
    const managedAdapter = adapterWallets.find(
      (w) =>
        w.adapter instanceof StandardWalletAdapter &&
        w.adapter.wallet === targetStandardWallet,
    );
    if (!managedAdapter) {
      const started = linkWaitStartedAtRef.current;
      const now =
        typeof performance !== "undefined" ? performance.now() : 0;
      if (
        started != null &&
        now - started < ADAPTER_GRACE_MS
      ) {
        emit({ kind: "selecting" });
        return;
      }
      emit({ kind: "no-privy-adapter" });
      return;
    }
    if (isManagedStandardAdapter(wallet?.adapter, targetStandardWallet)) {
      emit({ kind: "connecting" });
      return;
    }
    emit({ kind: "selecting" });
  }, [
    privyReady,
    walletsReady,
    authenticated,
    targetAddress,
    targetStandardWallet,
    wallet,
    adapterWallets,
    connected,
    connecting,
  ]);

  // ---- 1) Select the Privy adapter when authenticated and not already on it.
  useEffect(() => {
    if (!privyReady || !walletsReady) return;
    if (!authenticated || !targetAddress || !targetStandardWallet) return;
    if (wallet && !isManagedStandardAdapter(wallet.adapter, targetStandardWallet))
      return;
    if (isManagedStandardAdapter(wallet?.adapter, targetStandardWallet)) return;

    const managedAdapter = adapterWallets.find(
      (w) =>
        w.adapter instanceof StandardWalletAdapter &&
        w.adapter.wallet === targetStandardWallet,
    );
    if (!managedAdapter) {
      const gen = ++adapterPollGenRef.current;
      const nextAttempt = adapterPollAttemptRef.current + 1;
      const delay = Math.min(
        ADAPTER_POLL_MAX_MS,
        Math.round(ADAPTER_POLL_BASE_MS * Math.pow(1.28, nextAttempt - 1)),
      );
      const id = window.setTimeout(() => {
        if (adapterPollGenRef.current !== gen) return;
        adapterPollAttemptRef.current = nextAttempt;
        setReconnectTick((t) => t + 1);
      }, delay);
      return () => {
        window.clearTimeout(id);
      };
    }
    adapterPollAttemptRef.current = 0;

    console.info(
      "[PrivyWalletBridge] selecting",
      managedAdapter.adapter.name,
      "for",
      targetAddress,
    );
    select(managedAdapter.adapter.name);
  }, [
    privyReady,
    walletsReady,
    authenticated,
    targetAddress,
    targetStandardWallet,
    wallet,
    adapterWallets,
    select,
    reconnectTick,
  ]);

  // ---- 2) Connect to the Privy adapter once selection has propagated.
  useEffect(() => {
    if (!authenticated || !targetAddress) return;
    if (!isManagedStandardAdapter(wallet?.adapter, targetStandardWallet))
      return;
    if (connected) {
      attemptedAddressRef.current = targetAddress;
      return;
    }
    if (connecting) return;
    if (attemptedAddressRef.current === targetAddress) return;

    attemptedAddressRef.current = targetAddress;
    console.info("[PrivyWalletBridge] connecting", targetAddress);
    const runConnect = () => {
      void connect().catch((err) => {
        console.warn("[PrivyWalletBridge] connect failed", err);
        attemptedAddressRef.current = null;
        emit({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    };
    // Defer one microtask so `select()` has propagated to `wallet` in state.
    queueMicrotask(runConnect);
  }, [
    authenticated,
    targetAddress,
    targetStandardWallet,
    wallet,
    connected,
    connecting,
    connect,
    reconnectTick,
  ]);

  // ---- 3) Tear down on Privy logout.
  useEffect(() => {
    if (!privyReady) return;
    if (authenticated && targetAddress) return;

    attemptedAddressRef.current = null;
    const std = managedStandardRef.current;
    const a = wallet?.adapter;
    if (a instanceof StandardWalletAdapter && std && a.wallet === std) {
      void disconnect().catch(() => {
        /* ignore */
      });
    }
    if (!authenticated) managedStandardRef.current = null;
  }, [privyReady, authenticated, targetAddress, wallet, disconnect]);

  return null;
}
