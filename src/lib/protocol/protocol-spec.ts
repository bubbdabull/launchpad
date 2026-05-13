/**
 * PROTOCOL SPEC (READ-ONLY)
 *
 * Canonical economic + lifecycle semantics for Creator Launchpad.
 * Used only for validation, enforcement, and CI — never for runtime execution
 * of financial logic.
 */

export const PROTOCOL_SPEC_VERSION = "1.0.0" as const;

/** On-chain lifecycle discriminator (Anchor `LaunchState`-style). */
export type LaunchState =
  | "DRAFT"
  | "VAULT_OPEN"
  | "MINT_ACTIVE"
  | "TRADING_ACTIVE"
  | "CLAIM_ACTIVE"
  | "FINALIZED";

export const LAUNCH_STATE_VALUES: readonly LaunchState[] = [
  "DRAFT",
  "VAULT_OPEN",
  "MINT_ACTIVE",
  "TRADING_ACTIVE",
  "CLAIM_ACTIVE",
  "FINALIZED",
] as const;

/**
 * RULE: State transitions are monotonic along the primary spine and irreversible
 * except where the program explicitly defines an admin/reset authority (not
 * API routes). No Next.js route may assert or persist lifecycle transitions as
 * authority over this enum.
 */
export const L1_ECONOMIC_MODEL = {
  alphaVault: "Deposit entry primitive only (raise path).",
  dammV2:
    "Meteora DAMM v2 pool (customizable + Alpha Vault handoff). Pool create uses isLockLiquidity (permanentLockPosition) so seeded LP is locked; deploy revokes SPL mint authority after vault (1B fixed). Launch-controller taxes DAMM swaps at 300 bps per monetization.rs.",
  coreNfts: "Identity + entitlement anchor; claim paths bind to receipts + LaunchState on-chain.",
} as const;

// --- Formal invariants (pure predicates / documented obligations) ---

/**
 * Invariant 1 — No off-chain allocation authority.
 * Allocation amounts that settle value MUST be derivable from on-chain state
 * (receipts, vault accounts, program math) — never from L2/L3 as source of truth.
 */
export function invariantNoOffchainAllocationAuthority(offChainAllocationDeclared: boolean): boolean {
  return !offChainAllocationDeclared;
}

/**
 * Invariant 2 — Fee integrity.
 * `platform_fee_bps` (when present) applies only inside L1 CPI execution.
 * L2/L3 MUST NOT compute authoritative fee splits (mirrors may display reads only).
 */
export function invariantFeeIntegrityLayer(layer: "L1" | "L2" | "L3", computesAuthoritativeFee: boolean): boolean {
  if (layer === "L1") return true;
  return !computesAuthoritativeFee;
}

/**
 * Invariant 3 — Claim safety (on-chain obligation).
 * Modeled here as a pure relation; enforcement is on-chain only.
 */
export function invariantClaimSafety(totalClaimed: bigint, totalVaultEmitted: bigint): boolean {
  return totalClaimed <= totalVaultEmitted;
}

/**
 * Invariant 4 — NFT entitlement binding.
 * Eligibility MUST be expressible as a function of on-chain NFT ownership +
 * LaunchState + MintReceipt (or successor receipt accounts) — not DB-inferred authority.
 */
export function invariantNftEntitlementBinding(entitlementFromDbOnly: boolean): boolean {
  return !entitlementFromDbOnly;
}

const protocolSpec = {
  version: PROTOCOL_SPEC_VERSION,
  launchStates: LAUNCH_STATE_VALUES,
  economicModel: L1_ECONOMIC_MODEL,
  invariants: {
    noOffchainAllocationAuthority: invariantNoOffchainAllocationAuthority,
    feeIntegrityLayer: invariantFeeIntegrityLayer,
    claimSafety: invariantClaimSafety,
    nftEntitlementBinding: invariantNftEntitlementBinding,
  },
} as const;

export default protocolSpec;
