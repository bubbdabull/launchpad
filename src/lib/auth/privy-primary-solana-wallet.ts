import type { Wallet } from "@wallet-standard/base";

/**
 * Privy often lists the embedded "Privy" Solana wallet before linked externals
 * (Phantom, etc.). Prefer the first non-embedded wallet when multiple exist
 * so signing matches the wallet the user picked.
 *
 * Keep in sync with server `pickSolanaAddress` in `privy-server.ts`.
 */
export function pickPrimaryPrivySolanaWallet<
  T extends { address: string; standardWallet: Wallet },
>(entries: readonly T[]): T | null {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0];
  const external = entries.find((e) => {
    const n = String(e.standardWallet?.name ?? "").toLowerCase();
    return n.length > 0 && n !== "privy";
  });
  return external ?? entries[0];
}
