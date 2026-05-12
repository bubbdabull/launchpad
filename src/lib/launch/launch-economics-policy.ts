/**
 * Launch economics bounds (supply, per-NFT mint price, optional total-raise cap).
 * Used by the create flow and tier validation for Alpha Vault + Genesis Pass mints.
 */

export const LAUNCH_ECONOMICS_POLICY = {
  MIN_SUPPLY: 25,
  MAX_SUPPLY: 100_000,
  MIN_MINT_PRICE_SOL: 0.05,
  MAX_MINT_PRICE_SOL: 25,
  MAX_VAULT_RAISE_SOL: 5_000,
} as const;

export type LaunchEconomicsPolicyError =
  | { code: "supply_low" }
  | { code: "supply_high" }
  | { code: "price_low" }
  | { code: "price_high" }
  | { code: "raise_high"; targetSol: number };

export function validateLaunchEconomicsInputs(input: {
  supply: number;
  mintPriceSol: number;
}): LaunchEconomicsPolicyError | null {
  const { supply, mintPriceSol } = input;

  if (!Number.isFinite(supply) || supply < LAUNCH_ECONOMICS_POLICY.MIN_SUPPLY) {
    return { code: "supply_low" };
  }
  if (supply > LAUNCH_ECONOMICS_POLICY.MAX_SUPPLY) {
    return { code: "supply_high" };
  }
  if (!Number.isFinite(mintPriceSol) || mintPriceSol < LAUNCH_ECONOMICS_POLICY.MIN_MINT_PRICE_SOL) {
    return { code: "price_low" };
  }
  if (mintPriceSol > LAUNCH_ECONOMICS_POLICY.MAX_MINT_PRICE_SOL) {
    return { code: "price_high" };
  }

  const targetSol = supply * mintPriceSol;
  if (targetSol > LAUNCH_ECONOMICS_POLICY.MAX_VAULT_RAISE_SOL) {
    return { code: "raise_high", targetSol };
  }
  return null;
}

export function explainLaunchEconomicsError(err: LaunchEconomicsPolicyError): string {
  switch (err.code) {
    case "supply_low":
      return `NFT supply must be at least ${LAUNCH_ECONOMICS_POLICY.MIN_SUPPLY}.`;
    case "supply_high":
      return `NFT supply can't exceed ${LAUNCH_ECONOMICS_POLICY.MAX_SUPPLY.toLocaleString()}.`;
    case "price_low":
      return `Mint price must be at least ${LAUNCH_ECONOMICS_POLICY.MIN_MINT_PRICE_SOL} SOL per NFT.`;
    case "price_high":
      return `Mint price can't exceed ${LAUNCH_ECONOMICS_POLICY.MAX_MINT_PRICE_SOL} SOL.`;
    case "raise_high":
      return `Total if all mints sell (supply × mint price ≈ ${Math.round(err.targetSol).toLocaleString()} SOL) can't exceed ${LAUNCH_ECONOMICS_POLICY.MAX_VAULT_RAISE_SOL.toLocaleString()} SOL.`;
  }
}
