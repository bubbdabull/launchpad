/**
 * Deploy-on-chain step 2: create the Metaplex Core "collection NFT".
 *
 * This is the parent collection that every Genesis Pass will be minted under.
 * Built on Metaplex Core (mpl-core) for cheap, single-account NFTs with
 * native plugin support (we attach Royalties at collection level).
 *
 * Returns a legacy Transaction the creator's wallet sends with the collection
 * keypair as a co-signer:
 *   await wallet.sendTransaction(tx, connection, { signers: [collectionKp] });
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import {
  buildCreateCoreCollectionInstructions,
  createUmiForEndpoint,
  withWalletAdapter,
  type WalletAdapterLike,
} from "@/lib/metaplex/core";

export type DeployCollectionInput = {
  payer: PublicKey;
  /** Wallet adapter — used as umi identity so the SDK signs with the creator. */
  wallet: WalletAdapterLike;
  /** Display name of the collection, e.g. "Relics of Wire — Genesis Pass". */
  name: string;
  /** Off-chain metadata JSON URI for the collection. */
  uri: string;
  /** Royalty in basis points (default 500 = 5%). */
  royaltyBps?: number;
};

export type DeployCollectionResult = {
  tx: Transaction;
  /** The collection address keypair — wallet must include this in signers. */
  signers: Keypair[];
  addresses: {
    coreCollection: string;
  };
};

export async function buildDeployCollectionTx(
  connection: Connection,
  input: DeployCollectionInput,
): Promise<DeployCollectionResult> {
  const umi = withWalletAdapter(createUmiForEndpoint(connection.rpcEndpoint), input.wallet);

  const built = await buildCreateCoreCollectionInstructions(umi, {
    name: input.name,
    uri: input.uri,
    royaltyBps: input.royaltyBps ?? 500,
    creators: [input.payer],
  });

  const tx = new Transaction();
  for (const ix of built.instructions) tx.add(ix);

  tx.feePayer = input.payer;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  // umi's KeypairSigner exposes secretKey under the hood; convert to web3.js
  // Keypair so we can hand a homogeneous Signer[] to wallet-adapter.
  const keypairs: Keypair[] = [];
  for (const s of built.signers) {
    const secret = (s as unknown as { secretKey?: Uint8Array }).secretKey;
    if (secret) keypairs.push(Keypair.fromSecretKey(secret));
  }

  if (keypairs.length > 0) {
    tx.partialSign(...keypairs);
  }

  return {
    tx,
    signers: keypairs,
    addresses: {
      coreCollection: built.collection.toBase58(),
    },
  };
}
