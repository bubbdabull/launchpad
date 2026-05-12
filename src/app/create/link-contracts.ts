// Deprecated EVM helper. The Solana platform uses Meteora Alpha Vault + Metaplex Core
// and links collections via `src/app/create/actions.ts` server actions. This
// stub is kept so any stale EVM-era imports compile without breaking the
// build.

export type LinkDeployedContractsArgs = {
  slug: string;
  // Legacy fields are accepted but ignored.
  [key: string]: unknown;
};

export async function linkDeployedContracts(
  _args: LinkDeployedContractsArgs
): Promise<{ ok: false; error: string }> {
  return {
    ok: false,
    error:
      "linkDeployedContracts is removed. Use the Solana deploy flow in DeployOnChainPanel.",
  };
}
