/**
 * Browser-safe cluster config (no `server-only` import). Reads NEXT_PUBLIC_*
 * envs only.
 */
export type SolanaCluster = "mainnet-beta" | "devnet";

export function getPublicCluster(): SolanaCluster {
  const v = process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.trim();
  return v === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

function heliusRpcUrl(cluster: SolanaCluster, key: string): string {
  const host = cluster === "mainnet-beta" ? "mainnet.helius-rpc.com" : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${key}`;
}

/**
 * Browser-side RPC URL. Resolution order:
 *   1. Explicit override `NEXT_PUBLIC_SOLANA_RPC_URL`
 *   2. Derived from `NEXT_PUBLIC_HELIUS_API_KEY` + cluster
 *   3. Public Solana endpoint
 */
export function getPublicRpcUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (explicit) return explicit;
  const helius = process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim();
  if (helius) return heliusRpcUrl(getPublicCluster(), helius);
  if (getPublicCluster() === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  return "https://api.devnet.solana.com";
}

export function explorerUrl(kind: "tx" | "address", value: string): string {
  const cluster = getPublicCluster();
  const suffix = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${value}${suffix}`;
}
