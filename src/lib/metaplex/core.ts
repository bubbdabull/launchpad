/**
 * Metaplex Core wrappers.
 *
 * Wrap `@metaplex-foundation/mpl-core` (via umi) and convert its instructions
 * into web3.js `TransactionInstruction`s so they can be spliced into our
 * atomic Alpha Vault mint transaction (vault deposit + Core + memo).
 *
 * v1 plugin set:
 *   - Attributes plugin holding mint metadata (order, vault deposit, etc.)
 *
 * The Attributes plugin is what makes a Genesis Pass a receipt of its mint.
 */

import { PublicKey, type TransactionInstruction } from "@solana/web3.js";

import {
  create,
  createCollection,
  ruleSet,
} from "@metaplex-foundation/mpl-core";
import {
  generateSigner,
  percentAmount,
  publicKey,
  signerIdentity,
  type Signer,
  type Umi,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

export type WalletAdapterLike = Parameters<typeof walletAdapterIdentity>[0];

/** Build a fresh umi instance for a given RPC endpoint, identity-less. */
export function createUmiForEndpoint(endpoint: string): Umi {
  return createUmi(endpoint);
}

/** Attach a wallet-adapter wallet as the signer identity. Use in the browser. */
export function withWalletAdapter(umi: Umi, wallet: WalletAdapterLike): Umi {
  return umi.use(walletAdapterIdentity(wallet));
}

/** Attach an arbitrary umi `Signer` (e.g. a generated keypair). Use server-side. */
export function withSigner(umi: Umi, signer: Signer): Umi {
  return umi.use(signerIdentity(signer));
}

export type CreateCoreCollectionInput = {
  name: string;
  /** Off-chain JSON metadata URI (Arweave / IPFS / your /api/metadata route). */
  uri: string;
  /** Royalty in basis points (0–10000). */
  royaltyBps?: number;
  /** Optional creator addresses for royalty splits. */
  creators?: PublicKey[];
};

/**
 * Build the instructions to create a Metaplex Core collection (the parent
 * "collection NFT" that all Genesis Passes are minted under).
 *
 * Returns the raw web3.js instructions and the new collection address so the
 * caller can choose whether to send standalone or compose into a larger tx.
 */
export async function buildCreateCoreCollectionInstructions(
  umi: Umi,
  input: CreateCoreCollectionInput,
): Promise<{ instructions: TransactionInstruction[]; collection: PublicKey; signers: Signer[] }> {
  const collectionSigner = generateSigner(umi);
  const royalty = Math.max(0, Math.min(10_000, input.royaltyBps ?? 500));

  const builder = createCollection(umi, {
    collection: collectionSigner,
    name: input.name,
    uri: input.uri,
    plugins:
      royalty > 0
        ? [
            {
              type: "Royalties",
              basisPoints: royalty,
              creators: (input.creators ?? []).map((c) => ({
                address: publicKey(c.toBase58()),
                percentage: 100 / Math.max(1, input.creators?.length ?? 1),
              })),
              ruleSet: ruleSet("None"),
            },
          ]
        : [],
  });

  const umiIxs = builder.getInstructions();
  return {
    instructions: umiIxs.map((ix) => toWeb3JsInstruction(ix)),
    collection: new PublicKey(collectionSigner.publicKey),
    signers: [collectionSigner],
  };
}

export type MintCoreAssetInput = {
  /** The collection mint to attach this asset to. */
  collection: PublicKey;
  /** Owner that receives the new asset. */
  owner: PublicKey;
  /** Display name, e.g. "Genesis Pass #387". */
  name: string;
  /** Off-chain metadata URI for the asset. */
  uri: string;
  /** On-chain attributes that turn the NFT into a permanent receipt. */
  attributes: Array<{ key: string; value: string }>;
  /**
   * When set, used as the new asset signer so the metadata URI can include this
   * pubkey before `create` is built (co-signed mint tx).
   */
  assetSigner?: Signer;
};

/**
 * Build the instructions to mint one Metaplex Core asset under `collection`,
 * with an Attributes plugin recording its position in the launch.
 */
export async function buildMintCoreAssetInstructions(
  umi: Umi,
  input: MintCoreAssetInput,
): Promise<{ instructions: TransactionInstruction[]; asset: PublicKey; signers: Signer[] }> {
  const assetSigner = input.assetSigner ?? generateSigner(umi);

  /** mpl-core 1.x: use `create` so plugins are mapped via `pluginAuthorityPairV2` (expects `type` + data). */
  const plugins = [
    {
      type: "Attributes" as const,
      attributeList: input.attributes,
    },
  ];

  const collectionRef = { publicKey: publicKey(input.collection.toBase58()) };

  const builder = create(umi, {
    asset: assetSigner,
    collection: collectionRef,
    name: input.name,
    uri: input.uri,
    owner: publicKey(input.owner.toBase58()),
    plugins,
    sellerFeeBasisPoints: percentAmount(0),
  });

  const umiIxs = builder.getInstructions();
  return {
    instructions: umiIxs.map((ix) => toWeb3JsInstruction(ix)),
    asset: new PublicKey(assetSigner.publicKey),
    signers: [assetSigner],
  };
}
