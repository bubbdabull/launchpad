/**
 * Referral cookie helpers.
 *
 * The capture flow lives in Next.js proxy (`src/proxy.ts`):
 *   1) Visitor lands on any URL with `?ref=<wallet>`
 *   2) Proxy writes `lp_ref=<wallet>` for 90 days
 *   3) On mint, the client posts the cookie value to /api/referrals/record
 *      along with the mint tx signature
 *
 * Self-referrals are prevented at the API layer (we know who's signing).
 * Format validation lives here so the cookie can never be poisoned with
 * arbitrary user input — only valid Solana base58 wallets are stored.
 */

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const REFERRAL_COOKIE = "lp_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** Returns the wallet only if it looks like a valid base58 Solana pubkey. */
export function sanitizeReferrerWallet(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!BASE58_RE.test(trimmed)) return null;
  return trimmed;
}
