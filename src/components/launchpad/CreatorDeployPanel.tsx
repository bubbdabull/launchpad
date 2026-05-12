"use client";

// Deprecated. The Solana deploy flow now lives in
// `src/components/launch/DeployOnChainPanel.tsx` and uses Solana web3.js plus
// Meteora Alpha Vault + Metaplex Core tooling instead of wagmi/viem. This module
// is retained as a thin re-export so any stale EVM-era imports still compile.

export { DeployOnChainPanel as CreatorDeployPanel } from "@/components/launch/DeployOnChainPanel";
