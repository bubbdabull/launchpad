import type { Collection } from "@/types/collection";

/**
 * Total quote-side deposits through this launchpad if every Genesis Pass mints
 * at the flat `mintPriceLamports` (supply × price). Use this to size a Meteora
 * Alpha Vault cap / raise target — Meteora still owns the on-chain limits.
 */
export function primarySalesVaultTargetLamports(
  c: Pick<Collection, "supply" | "mintPriceLamports">,
): bigint | null {
  const price = c.mintPriceLamports;
  if (price === undefined || price <= BigInt(0)) return null;
  const n = c.supply;
  if (!Number.isFinite(n) || n < 0) return null;
  const supplyInt = Math.max(0, Math.trunc(n));
  return BigInt(supplyInt) * price;
}

export function lamportsToSolString(lamports: bigint, maximumFractionDigits = 4): string {
  const sol = Number(lamports) / 1_000_000_000;
  return `${sol.toLocaleString(undefined, { maximumFractionDigits })} SOL`;
}
