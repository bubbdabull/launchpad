/**
 * NON-FINANCIAL social / status labels only.
 * No XP math that gates money; no entitlement. Cosmetic + engagement copy.
 */

export const CREATOR_RANK_LABELS = ["Observer", "Rising", "Established", "Icon"] as const;

export const SUPPORTER_BADGES = [
  "Early minter",
  "Vault wave 1",
  "Genesis flex",
  "Top signal",
  "Streak 7",
] as const;

export type SupporterBadge = (typeof SUPPORTER_BADGES)[number];
