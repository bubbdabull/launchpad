/** Flat platform fees (lamports). Shared by mint + deploy flows. */

const DEFAULT_DEPLOY_FEE_LAMPORTS = 200_000_000n;
const DEFAULT_MINT_FEE_LAMPORTS = 20_000_000n;

function readLamportsEnv(publicKey: string, serverKey: string, fallback: bigint): bigint {
  const raw =
    (typeof process !== "undefined" ? process.env[publicKey] : undefined)?.trim() ||
    (typeof process !== "undefined" ? process.env[serverKey] : undefined)?.trim();
  if (!raw) return fallback;
  try {
    const value = BigInt(raw);
    return value < 0n ? 0n : value;
  } catch {
    return fallback;
  }
}

/** Read the platform deploy fee from env, with a 0.2 SOL fallback (unused for Alpha-only deploy UI). */
export function getPlatformDeployFeeLamports(): bigint {
  return readLamportsEnv(
    "NEXT_PUBLIC_PLATFORM_DEPLOY_FEE_LAMPORTS",
    "PLATFORM_DEPLOY_FEE_LAMPORTS",
    DEFAULT_DEPLOY_FEE_LAMPORTS,
  );
}

/** Read the flat per-mint platform fee from env, with a 0.02 SOL fallback. */
export function getPlatformMintFeeLamports(): bigint {
  return readLamportsEnv(
    "NEXT_PUBLIC_PLATFORM_MINT_FEE_LAMPORTS",
    "PLATFORM_MINT_FEE_LAMPORTS",
    DEFAULT_MINT_FEE_LAMPORTS,
  );
}
