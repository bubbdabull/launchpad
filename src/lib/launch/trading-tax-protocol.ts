/**
 * DAMM / launch-controller **trading tax** surface — must match
 * `anchor/programs/launch-controller/src/monetization.rs`:
 * `TRADING_TAX_BPS`, `TRADING_TAX_PLATFORM_LEG_BPS`, `split_trading_tax_settlement`.
 *
 * Tax is on trade amount; platform takes a **floor** share of the tax; the remainder is the
 * creator leg, then `nft_holder_share_bps` splits creator leg (floor) to holder rewards vs creator vault.
 */

export const TRADING_TAX_BPS = 300;
/** 20% of the tax (not of trade volume) goes to platform — see `split_trading_tax_settlement`. */
export const TRADING_TAX_PLATFORM_LEG_BPS = 2000;
const BPS_DENOM = 10_000;

/** Trading tax as % of trade volume (e.g. 300 → 3%). */
export function tradingTaxPctLabel(fractionDigits = 2): string {
  return `${(TRADING_TAX_BPS / 100).toFixed(fractionDigits)}%`;
}

/** Platform’s approximate share of trade volume in bps (floor(tax) * 2000 / 10_000 on unit math). */
export function platformShareOfTradeApproxBps(): number {
  return Math.floor((TRADING_TAX_BPS * TRADING_TAX_PLATFORM_LEG_BPS) / BPS_DENOM);
}

/** Creator leg of tax ≈ 80% of tax, expressed as bps of trade volume (display). */
export function creatorLegOfTradeApproxBps(): number {
  return TRADING_TAX_BPS - platformShareOfTradeApproxBps();
}

/**
 * Split the creator leg by holder % (0–100): same shape as on-chain `nft_holder_share_bps` applied to creator_leg.
 * Uses whole bps of trade for UI (small rounding vs nested floor on each swap).
 */
export function splitCreatorLegForDisplay(holderRewardPct: number): {
  creatorVaultApproxBps: number;
  holderApproxBps: number;
} {
  const leg = creatorLegOfTradeApproxBps();
  const h = Math.max(0, Math.min(100, Math.round(holderRewardPct)));
  const holderApproxBps = Math.floor((leg * h) / 100);
  const creatorVaultApproxBps = Math.max(0, leg - holderApproxBps);
  return { creatorVaultApproxBps, holderApproxBps };
}
