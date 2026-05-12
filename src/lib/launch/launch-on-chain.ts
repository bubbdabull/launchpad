import type { Collection } from "@/types/collection";

type MintSetup = Pick<Collection, "coreCollection" | "alphaVault">;

/** Core collection + Meteora Alpha Vault — required for Genesis mint on this launchpad. */
export function launchMintSetupComplete(c: MintSetup): boolean {
  return !!c.coreCollection && !!c.alphaVault;
}

/**
 * Public mint gate: **on-chain readiness mirrors** (vault + collection), not
 * `collections.status` from Supabase (lifecycle authority is on-chain only).
 */
export function canPublicMintGenesisPass(c: Pick<Collection, "coreCollection" | "alphaVault" | "minted" | "supply" | "status">): boolean {
  if (c.status === "sold_out") return false;
  if (c.minted >= c.supply) return false;
  return launchMintSetupComplete(c);
}
