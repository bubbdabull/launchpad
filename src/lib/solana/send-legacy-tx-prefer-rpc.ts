import type { Connection, Keypair, SendOptions, Transaction } from "@solana/web3.js";
import { VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

/**
 * Sends a **legacy** `Transaction` through the app `Connection` (Helius / public RPC) after the wallet signs.
 *
 * Some embedded wallets (e.g. Privy) route `wallet.sendTransaction` through Jupiter’s `wallet-api` broadcast,
 * which can return 500 for otherwise valid txs. When `wallet.signTransaction` exists, we partial-sign any
 * extra keypairs, ask the wallet to sign, then `connection.sendRawTransaction` — same pattern as
 * `@solana/wallet-adapter-base` for legacy txs, but **without** going through the adapter’s `sendTransaction`
 * implementation that may proxy broadcast.
 */
export async function sendLegacyTransactionPreferRpc(
  wallet: WalletContextState,
  connection: Connection,
  transaction: Transaction,
  opts?: { signers?: Keypair[] } & SendOptions,
): Promise<string> {
  const { signers = [], ...sendOptions } = opts ?? {};
  if (!wallet.publicKey) throw new Error("Connect wallet first.");

  if (typeof wallet.signTransaction === "function") {
    const tx = transaction;
    if (signers.length) tx.partialSign(...signers);
    const signed = await wallet.signTransaction(tx);
    const raw = signed.serialize();
    return await connection.sendRawTransaction(raw, sendOptions);
  }

  if (!wallet.sendTransaction) {
    throw new Error("Wallet does not support signTransaction or sendTransaction.");
  }
  return wallet.sendTransaction(transaction, connection, { signers });
}

/**
 * Same RPC-broadcast idea for **VersionedTransaction** (v0), used by hybrid mints.
 */
export async function sendVersionedTransactionPreferRpc(
  wallet: WalletContextState,
  connection: Connection,
  transaction: VersionedTransaction,
  opts?: SendOptions,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Connect wallet first.");

  if (typeof wallet.signTransaction === "function") {
    const signed = await wallet.signTransaction(transaction);
    return await connection.sendRawTransaction(signed.serialize(), opts ?? {});
  }

  if (!wallet.sendTransaction) {
    throw new Error("Wallet does not support signTransaction or sendTransaction.");
  }
  return wallet.sendTransaction(transaction, connection, opts);
}
