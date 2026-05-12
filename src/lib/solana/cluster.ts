import "server-only";

export type SolanaCluster = "mainnet-beta" | "devnet";

export function getCluster(): SolanaCluster {
  const v = process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.trim();
  return v === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

/** Derive a Helius RPC URL from a key + cluster. */
function heliusRpcUrl(cluster: SolanaCluster, key: string): string {
  const host = cluster === "mainnet-beta" ? "mainnet.helius-rpc.com" : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${key}`;
}

/**
 * Server-side RPC URL. Resolution order:
 *   1. Explicit override `SOLANA_RPC_URL`
 *   2. Derived from `HELIUS_API_KEY` + `NEXT_PUBLIC_SOLANA_CLUSTER`
 *   3. Public Solana endpoint
 */
export function getRpcUrl(): string {
  const explicit = process.env.SOLANA_RPC_URL?.trim();
  if (explicit) return explicit;
  const helius = process.env.HELIUS_API_KEY?.trim();
  if (helius) return heliusRpcUrl(getCluster(), helius);
  if (getCluster() === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  return "https://api.devnet.solana.com";
}

/** Helius "enhanced API" base URL (Asset API, Enhanced Tx, etc.). */
export function getHeliusApiBaseUrl(): string | null {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) return null;
  const host = getCluster() === "mainnet-beta" ? "mainnet.helius-rpc.com" : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${key}`;
}
