/**
 * Meteora DAMM v2 (CP-AMM) wrappers.
 *
 * After the Alpha Vault raise completes, liquidity is expected on DAMM v2. Genesis Pass
 * holders continue earning trading fees from this pool. This module exposes
 * a thin surface for reading pool state and quoting swaps.
 */

import { Connection, PublicKey } from "@solana/web3.js";

export type DammPoolState = {
  pool: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
  /** Current spot price in lamports per token. */
  spotPriceLamports: bigint;
  /** 24h trading volume in lamports (best-effort, may be 0n if no indexer). */
  volume24hLamports: bigint;
  /** Accrued fees claimable by Genesis Pass holders, in lamports. */
  accruedHolderFeesLamports: bigint;
};

export async function getDammPoolState(_connection: Connection, pool: PublicKey): Promise<DammPoolState> {
  // TODO: wire @meteora-ag/cp-amm-sdk to read pool state.
  return {
    pool,
    baseMint: PublicKey.default,
    quoteMint: PublicKey.default,
    baseReserve: BigInt(0),
    quoteReserve: BigInt(0),
    spotPriceLamports: BigInt(0),
    volume24hLamports: BigInt(0),
    accruedHolderFeesLamports: BigInt(0),
  };
}
