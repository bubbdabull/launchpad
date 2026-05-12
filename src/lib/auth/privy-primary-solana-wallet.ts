import type { Wallet } from "@wallet-standard/base";

/**
 * Privy often lists the embedded "Privy" Solana wallet before linked externals
 * (Jupiter, Phantom, …). Prefer the first non-embedded wallet when multiple exist
 * so signing + `useWallet()` align with the wallet the user actually uses.
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
