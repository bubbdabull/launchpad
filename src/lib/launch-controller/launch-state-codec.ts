/**
 * Decode on-chain `LaunchState` (Anchor 8-byte discriminator + Borsh body).
 * Kept free of `@solana/spl-token` so server bundles (e.g. Netlify) stay small.
 */
export function decodeLaunchStateAccountData(data: Buffer): {
  lifecycle: number;
  depositSeq: bigint;
  expectedQuotePerMint: bigint;
  genesisSupply: bigint;
  tradingLiveAt: bigint;
  sliceBReserveBps: number;
  sliceBCreatorOfReserveBps: number;
  bump: number;
} {
  if (data.byteLength < 214) {
    throw new Error(`LaunchState account too small: ${data.byteLength}`);
  }

  const lifecycleOffset = 160;
  const expectedQuoteOffset = 161;
  const depositSeqOffset = 185;
  const genesisSupplyOffset = 193;
  const tradingLiveAtOffset = 201;
  const sliceBReserveOffset = 209;
  const sliceBCreatorOffset = 211;
  const bumpOffset = 213;

  const lifecycle = data.readUInt8(lifecycleOffset);
  const expectedQuotePerMint = data.readBigUInt64LE(expectedQuoteOffset);
  const depositSeq = data.readBigUInt64LE(depositSeqOffset);
  const genesisSupply = data.readBigUInt64LE(genesisSupplyOffset);
  const tradingLiveAt = data.readBigInt64LE(tradingLiveAtOffset);
  const sliceBReserveBps = data.readUInt16LE(sliceBReserveOffset);
  const sliceBCreatorOfReserveBps = data.readUInt16LE(sliceBCreatorOffset);
  const bump = data.readUInt8(bumpOffset);

  return {
    lifecycle,
    depositSeq,
    expectedQuotePerMint,
    genesisSupply,
    tradingLiveAt,
    sliceBReserveBps,
    sliceBCreatorOfReserveBps,
    bump,
  };
}
