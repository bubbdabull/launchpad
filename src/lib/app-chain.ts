// Deprecated. The platform is Solana-only; chain selection is no longer a
// runtime concern. APP_MINT_CHAIN is retained as a literal "solana" string for
// backwards compatibility with stale imports. Prefer NEXT_PUBLIC_SOLANA_CLUSTER
// for the active cluster (mainnet-beta / devnet).

export const APP_MINT_CHAIN = "solana" as const;
export type AppMintChain = typeof APP_MINT_CHAIN;
