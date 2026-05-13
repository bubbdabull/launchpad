/**
 * Genesis Pass ↔ project token entitlement (product rules).
 *
 * Each launch has its own project SPL mint. On Genesis mint the buyer pays
 * (mint price → Meteora Alpha Vault quote deposit + genesis mint tax, 7% of mint price);
 * the Core NFT immediately but **no** project SPL in that transaction.
 *
 * Project tokens are **deferred**: buyers return later under unlock rules to
 * **claim** allocation. **Financial truth** lives in Anchor `MintReceipt` + `claim` —
 * metadata here is display only. Mint tx should append `record_genesis_participation`
 * (see `docs/ARCHITECTURE_ENFORCEMENT.md`).
 */

export const GENESIS_MINT_GRANTS_PROJECT_TOKENS = false;

/** Metadata attribute keys — indexers / future claim UI can read these. */
export const TOKEN_ENTITLEMENT_ATTR_KEYS = {
  projectTokensAtMint: "projectTokensAtMint",
  projectTokenClaim: "projectTokenClaim",
  tokensReceivedLamports: "tokensReceived",
} as const;

export function genesisPassTokenEntitlementMetadataAttributes(): Array<{ key: string; value: string }> {
  return [
    { key: TOKEN_ENTITLEMENT_ATTR_KEYS.projectTokensAtMint, value: "none" },
    /** Deferred claim after mint; buyer does not receive SPL in the mint tx. */
    { key: TOKEN_ENTITLEMENT_ATTR_KEYS.projectTokenClaim, value: "deferred" },
    { key: TOKEN_ENTITLEMENT_ATTR_KEYS.tokensReceivedLamports, value: "0" },
  ];
}
