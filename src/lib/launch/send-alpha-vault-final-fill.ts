import AlphaVaultSdk, { PoolType, VaultMode } from "@meteora-ag/alpha-vault";
import type { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { getPublicCluster } from "@/lib/solana/cluster-public";

type WalletWithLegacySend = {
  publicKey: PublicKey;
  sendTransaction: (transaction: Transaction, connection: Connection, options?: unknown) => Promise<string>;
};

/**
 * After the final Genesis mint tx is confirmed: build + send Meteora FCFS Alpha Vault fill for DAMM v2 (`fill_damm_v2`).
 * Minter is `cranker`. Wait for mint confirmation so vault totals include the last deposit before building the fill ix.
 */
export async function sendAlphaVaultFinalFillAfterLastMint(
  connection: Connection,
  wallet: WalletWithLegacySend,
  alphaVaultPk: PublicKey,
): Promise<void> {
  const av = await AlphaVaultSdk.create(connection, alphaVaultPk, { cluster: getPublicCluster() });
  if (av.vault.poolType !== PoolType.DAMMV2 || av.vault.vaultMode !== VaultMode.FCFS) return;

  const fillTx = await av.fillVault(wallet.publicKey);
  if (!fillTx || fillTx.instructions.length === 0) return;

  fillTx.feePayer = wallet.publicKey;
  const latest = await connection.getLatestBlockhash("confirmed");
  fillTx.recentBlockhash = latest.blockhash;
  fillTx.lastValidBlockHeight = latest.lastValidBlockHeight;

  const sig = await wallet.sendTransaction(fillTx, connection);
  await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed",
  );
}
