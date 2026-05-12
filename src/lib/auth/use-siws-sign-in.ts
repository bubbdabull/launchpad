"use client";

import { useCallback, useRef, useState } from "react";
import bs58 from "bs58";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { getPublicCluster } from "@/lib/solana/cluster-public";

import {
  PRIVY_AUTH_ENABLED,
  usePrivySiwsSigner,
} from "./privy-siws-signer";

export type SiwsStatus = "idle" | "busy" | "error";

function buildClientSiwsMessage(
  domain: string,
  address: string,
  nonce: string
): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "Sign in to Creator Launchpad.",
    "",
    `Cluster: ${getPublicCluster()}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

/** Parse JSON from a Response without throwing on empty / non-JSON bodies. */
async function parseFetchJson<T extends Record<string, unknown>>(
  res: Response
): Promise<{ data: T | null }> {
  const text = await res.text();
  if (!text.trim()) return { data: null };
  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return { data: null };
  }
}

/**
 * Sign-In With Solana flow.
 *
 * In Privy mode (`NEXT_PUBLIC_PRIVY_ENABLED=true`) we sign through Privy's
 * `useSignMessage` directly with `showWalletUIs:false`, so an email user
 * goes from "completed Privy login" → server session in a single hop with
 * no extra confirmation modal. We do NOT depend on the wallet-adapter
 * bridge for this handshake — that bridge stays for transaction signing
 * (mint / deploy / trade) but it is not on the auth critical path.
 *
 * In dev mode (Privy disabled) we fall back to wallet-adapter's signMessage,
 * which prompts the connected wallet (Phantom / Solflare).
 */
export function useSiwsSignIn() {
  const router = useRouter();
  const { publicKey, signMessage: walletAdapterSignMessage } = useWallet();
  const privy = usePrivySiwsSigner();

  const [status, setStatus] = useState<SiwsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlightForRef = useRef<string | null>(null);

  const activeAddress =
    privy?.address ?? publicKey?.toBase58() ?? null;

  const runSignIn = useCallback(async (): Promise<void> => {
    const address = activeAddress;
    if (!address) {
      setStatus("error");
      setError("Wallet not connected.");
      return;
    }
    if (inFlightForRef.current === address) return;
    inFlightForRef.current = address;
    try {
      setError(null);
      setStatus("busy");

      const nonceRes = await fetch("/api/auth/siws/nonce");
      const { data: nonceJson } = await parseFetchJson<{ nonce?: string }>(nonceRes);
      if (!nonceRes.ok || !nonceJson?.nonce) {
        throw new Error(
          nonceRes.status >= 500
            ? "Sign-in service unavailable. Try again in a moment."
            : "Couldn’t start sign-in. Check your connection and try again.",
        );
      }

      const message = buildClientSiwsMessage(
        window.location.host,
        address,
        nonceJson.nonce
      );
      const messageBytes = new TextEncoder().encode(message);

      let signature: string;
      if (privy?.signMessageBytes) {
        const sigBytes = await privy.signMessageBytes(messageBytes);
        signature = bs58.encode(sigBytes);
      } else if (walletAdapterSignMessage) {
        const sigBytes = await walletAdapterSignMessage(messageBytes);
        signature = bs58.encode(sigBytes);
      } else {
        throw new Error("This wallet doesn’t support message signing.");
      }

      const verifyRes = await fetch("/api/auth/siws/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature, address }),
      });
      const { data: verifyJson } = await parseFetchJson<{
        ok?: boolean;
        error?: string;
      }>(verifyRes);
      if (!verifyRes.ok || !verifyJson?.ok) {
        throw new Error(
          verifyJson?.error ??
            (verifyRes.status >= 500
              ? "Sign-in service unavailable. Try again in a moment."
              : "Sign-in didn’t verify."),
        );
      }

      setStatus("idle");
      router.refresh();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      inFlightForRef.current = null;
    }
  }, [activeAddress, privy, walletAdapterSignMessage, router]);

  const reset = useCallback(() => {
    setError(null);
    setStatus("idle");
    inFlightForRef.current = null;
  }, []);

  return {
    status,
    error,
    runSignIn,
    reset,
    activeAddress,
    privyEnabled: PRIVY_AUTH_ENABLED,
  };
}
