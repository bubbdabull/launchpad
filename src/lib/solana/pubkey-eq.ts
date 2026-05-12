import { PublicKey } from "@solana/web3.js";

/** True when both parse as the same Solana pubkey (trimmed); false if either is missing or invalid. */
export function solanaPubkeysEqual(
  a: string | undefined | null,
  b: PublicKey | string | undefined | null,
): boolean {
  const as = typeof a === "string" ? a.trim() : "";
  if (!as || b == null) return false;
  try {
    const pkA = new PublicKey(as);
    const pkB = b instanceof PublicKey ? b : new PublicKey(String(b).trim());
    return pkA.equals(pkB);
  } catch {
    return false;
  }
}
