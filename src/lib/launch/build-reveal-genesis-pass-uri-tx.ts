/**
 * Creator-signed Metaplex Core `updateV1` to point a Genesis Pass asset at a **pinned**
 * metadata URI (Arweave / IPFS) after reveal — optional hardening beyond dynamic `/api/metadata/asset`.
 *
 * L3 transaction building only; does not change MintReceipt or claim math.
 */

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  buildUpdateCoreAssetUriInstructions,
  createUmiForEndpoint,
  withWalletAdapter,
  type WalletAdapterLike,
} from "@/lib/metaplex/core";

export type RevealGenesisPassUriInput = {
  payer: PublicKey;
  wallet: WalletAdapterLike;
  asset: PublicKey;
  collection: PublicKey;
  newUri: string;
};

export async function buildRevealGenesisPassUriTx(
  connection: Connection,
  input: RevealGenesisPassUriInput,
): Promise<VersionedTransaction> {
  const umi = withWalletAdapter(createUmiForEndpoint(connection.rpcEndpoint), input.wallet);
  const built = await buildUpdateCoreAssetUriInstructions(umi, {
    asset: input.asset,
    collection: input.collection,
    newUri: input.newUri,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: input.payer,
    recentBlockhash: blockhash,
    instructions: built.instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
