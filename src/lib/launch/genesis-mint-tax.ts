/**
 * Genesis mint tax math — must stay in sync with
 * `anchor/programs/launch-controller/src/monetization.rs`:
 * `GENESIS_MINT_TAX_BPS`, `split_genesis_mint_tax`.
 */

export const GENESIS_MINT_TAX_BPS = 700n;
const CREATOR_SHARE_OF_MINT_TAX_BPS = 2000n;
const MINT_TAX_SPLIT_DENOM_BPS = 10000n;
const BPS_DENOMINATOR = 10000n;

export type GenesisMintTaxSplit = {
  /** Total tax on top of mint price (7% of mint price, floored). */
  mintTax: bigint;
  /** Platform leg of the tax (mint_tax − creator_share). */
  platformShare: bigint;
  /** Creator escrow leg of the tax (20% of mint_tax, floored). */
  creatorShare: bigint;
};

export function splitGenesisMintTaxLamports(mintPriceLamports: bigint): GenesisMintTaxSplit {
  if (mintPriceLamports <= 0n) {
    return { mintTax: 0n, platformShare: 0n, creatorShare: 0n };
  }
  const mintTax = (mintPriceLamports * GENESIS_MINT_TAX_BPS) / BPS_DENOMINATOR;
  const creatorShare = (mintTax * CREATOR_SHARE_OF_MINT_TAX_BPS) / MINT_TAX_SPLIT_DENOM_BPS;
  const platformShare = mintTax - creatorShare;
  return { mintTax, platformShare, creatorShare };
}

/** Total lamports the minter pays above mint price (same as Anchor `mint_nft` tax total). */
export function genesisMintTaxTotalLamports(mintPriceLamports: bigint): bigint {
  return splitGenesisMintTaxLamports(mintPriceLamports).mintTax;
}

/** Mint price field is in SOL (UI); convert to lamports for tax math. */
export function mintPriceSolToLamports(sol: number): bigint {
  if (!Number.isFinite(sol) || sol <= 0) return 0n;
  return BigInt(Math.round(sol * 1_000_000_000));
}
