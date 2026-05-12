"use client";

// Deprecated. The Solana mint flow now lives in
// `src/components/mint/GenesisPassMintPanel.tsx` and uses Solana web3.js +
// Metaplex Core via the wallet-adapter, not wagmi/viem. This file is retained
// as a thin re-export so any stale EVM-era imports compile.

export { GenesisPassMintPanel as MintPanel } from "./GenesisPassMintPanel";
