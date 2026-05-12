/**
 * Metaplex Token Metadata (classic) for an existing SPL mint — converts mpl-token-metadata
 * instructions to web3.js so they bundle with the pool + vault deploy transaction.
 */

import { createMetadataAccountV3 } from "@metaplex-foundation/mpl-token-metadata";
import { none, publicKey, type Umi } from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";

function trimMeta(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

export type SplTokenMetadataInput = {
  mint: PublicKey;
  /** Absolute https metadata JSON URI (e.g. /api/metadata/token/{slug} on your origin). */
  uri: string;
  name: string;
  symbol: string;
};

/**
 * `umi` must use `walletAdapterIdentity` so `mintAuthority` matches the creator signing the tx.
 */
export function buildSplTokenMetadataInstructions(
  umi: Umi,
  input: SplTokenMetadataInput,
): TransactionInstruction[] {
  const builder = createMetadataAccountV3(umi, {
    mint: publicKey(input.mint.toBase58()),
    mintAuthority: umi.identity,
    data: {
      name: trimMeta(input.name, 32),
      symbol: trimMeta(input.symbol.toUpperCase(), 10),
      uri: trimMeta(input.uri, 200),
      sellerFeeBasisPoints: 0,
      creators: none(),
      collection: none(),
      uses: none(),
    },
    isMutable: false,
    collectionDetails: none(),
  });
  return builder.getInstructions().map((ix) => toWeb3JsInstruction(ix));
}
