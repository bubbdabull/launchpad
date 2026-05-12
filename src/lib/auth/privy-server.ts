import "server-only";

import { cookies } from "next/headers";
import { PrivyClient, type AuthTokenClaims, type User } from "@privy-io/server-auth";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;

export const PRIVY_SERVER_ENABLED = Boolean(APP_ID && APP_SECRET);

/**
 * Returns a human-readable list of missing Privy env vars, or null if
 * everything is configured. Used by route handlers to surface a precise
 * error instead of a generic "Privy server auth is not configured."
 */
export function privyServerConfigMissing(): string | null {
  const missing: string[] = [];
  if (!APP_ID) missing.push("NEXT_PUBLIC_PRIVY_APP_ID");
  if (!APP_SECRET) missing.push("PRIVY_APP_SECRET");
  if (missing.length === 0) return null;
  return missing.join(", ");
}

let _client: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient | null {
  if (!APP_ID || !APP_SECRET) return null;
  if (!_client) _client = new PrivyClient(APP_ID, APP_SECRET);
  return _client;
}

/**
 * Verify a Privy access token (sent by the client via fetch with
 * `Authorization: Bearer <token>`). Returns null if the token is invalid,
 * expired, or doesn't match this app.
 */
export async function verifyPrivyAccessToken(
  token: string
): Promise<AuthTokenClaims | null> {
  const client = getPrivyClient();
  if (!client) return null;
  try {
    return await client.verifyAuthToken(token);
  } catch {
    return null;
  }
}

/**
 * Resolve the Privy `User` for a verified token. We use the privy-id-token
 * cookie (set by the Privy SDK in the browser) when present, since
 * `getUser({idToken})` parses the token locally — no API call. If the
 * idToken isn't available or doesn't include the wallet (Privy may
 * truncate large idTokens), we fall back to `getUserById`, which DOES hit
 * the Privy API and is rate-limited.
 */
export async function getPrivyUserFromCookies(): Promise<User | null> {
  const client = getPrivyClient();
  if (!client) return null;
  const store = await cookies();
  const idToken = store.get("privy-id-token")?.value;
  if (!idToken) return null;
  try {
    return await client.getUser({ idToken });
  } catch {
    return null;
  }
}

/**
 * Pulls the first Solana wallet address linked to the Privy user. Privy
 * stamps embedded wallets with `walletClientType:"privy"`; external
 * wallets (Phantom, Solflare) connected via Privy carry their own client
 * type. We don't care which — just that there's a Solana address we can
 * use as the user's identity on this platform.
 */
export function pickSolanaAddress(user: User): string | null {
  for (const account of user.linkedAccounts) {
    if (
      account.type === "wallet" &&
      account.chainType === "solana" &&
      typeof account.address === "string"
    ) {
      return account.address;
    }
  }
  return null;
}
