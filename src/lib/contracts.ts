// Deprecated EVM ABIs. The platform is Solana-only; collection minting now
// uses Metaplex Core (no Solidity ABIs). These exports are kept as empty
// arrays so any stale EVM-era imports still compile without breaking the
// build.

export const erc721Abi: readonly unknown[] = [];
export const mintCollectionAbi: readonly unknown[] = [];
