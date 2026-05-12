"use client";

import { usePrivy } from "@privy-io/react-auth";
import {
  useSignMessage as usePrivySignMessage,
  useWallets as usePrivySolanaWallets,
} from "@privy-io/react-auth/solana";

export const PRIVY_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export type PrivySiwsSigner = {
  /** Address of the connected Privy Solana wallet. */
  address: string;
  /** Sign raw bytes through Privy. Returns Uint8Array signature (64 bytes). */
  signMessageBytes: (message: Uint8Array) => Promise<Uint8Array>;
};

/**
 * Returns a Privy-backed signer when:
 *   - Privy is enabled in env
 *   - The user is currently authenticated through Privy
 *   - Privy has at least one Solana wallet ready (embedded or external)
 *
 * Otherwise returns null and callers should fall back to wallet-adapter.
 *
 * The actual signing call passes `showWalletUIs:false` so newly-signed-up
 * email users don't get a redundant "Sign message?" modal immediately
 * after completing the OTP flow — the user just authenticated, requesting
 * one extra confirmation per session feels broken to non-crypto users.
 * If you ever need user-visible confirmation (e.g. for high-value txs)
 * use `useSignTransaction` directly instead.
 */
export function usePrivySiwsSigner(): PrivySiwsSigner | null {
  if (!PRIVY_AUTH_ENABLED) return null;
  // Conditional hook is safe: PRIVY_AUTH_ENABLED is a build-time constant.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePrivySiwsSignerInner();
}

function usePrivySiwsSignerInner(): PrivySiwsSigner | null {
  const { authenticated, ready: privyReady } = usePrivy();
  const { ready: walletsReady, wallets } = usePrivySolanaWallets();
  const { signMessage } = usePrivySignMessage();

  if (!privyReady || !walletsReady) return null;
  if (!authenticated) return null;
  const wallet = wallets[0];
  if (!wallet) return null;

  return {
    address: wallet.address,
    signMessageBytes: async (message: Uint8Array) => {
      const result = await signMessage({
        message,
        wallet,
        options: { uiOptions: { showWalletUIs: false } },
      });
      return result.signature;
    },
  };
}
