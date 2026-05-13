/**
 * Build a Meteora permissionless FCFS Alpha Vault init tx for a DAMM v2 pool,
 * with deposit caps derived from launch supply × flat mint price.
 */

import AlphaVaultSdk, {
  PROGRAM_ID,
  PoolType,
  WhitelistMode,
  createCpAmmProgram,
  deriveAlphaVault,
} from "@meteora-ag/alpha-vault";
import BN from "bn.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { getPublicCluster } from "@/lib/solana/cluster-public";
import { primarySalesVaultTargetLamports } from "@/lib/launch/vault-economics";
import type { Collection } from "@/types/collection";

function ensure<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(msg);
  return v;
}

function alphaVaultProgramId(): PublicKey {
  const cluster = getPublicCluster();
  const id = PROGRAM_ID[cluster as keyof typeof PROGRAM_ID];
  if (!id) throw new Error(`Alpha Vault program id missing for cluster ${cluster}.`);
  return new PublicKey(id);
}

/** PDA for a customizable FCFS vault (funder = creator, tied to pool). */
export function deriveFcfsAlphaVaultPda(creator: PublicKey, pool: PublicKey): PublicKey {
  const [pda] = deriveAlphaVault(creator, pool, alphaVaultProgramId());
  return pda;
}

/**
 * Meteora FCFS init requires `baseMint` === pool `tokenAMint` and `quoteMint` === `tokenBMint`
 * (see `createCustomizableDammV2WithPermissionlessVault` in `@meteora-ag/alpha-vault-sdk`).
 * This deploy path uses token B = wrapped SOL so deposits stay in lamports.
 */
function fcfsBaseQuoteFromDammV2Pool(pool: { tokenAMint: PublicKey; tokenBMint: PublicKey }): {
  baseMint: PublicKey;
  quoteMint: PublicKey;
} {
  const { tokenAMint, tokenBMint } = pool;
  if (!tokenBMint.equals(NATIVE_MINT) || tokenAMint.equals(NATIVE_MINT)) {
    throw new Error(
      "This launch expects a DAMM v2 pool with token A = project mint and token B = wrapped SOL (Meteora Alpha Vault + SOL deposits). Recreate the pool from deploy step 1, or fix the pool pair in Meteora.",
    );
  }
  return { baseMint: tokenAMint, quoteMint: tokenBMint };
}

/** Slot-based FCFS timing (matches Meteora Alpha Vault client `vaultPoint` math). */
export function computeFcfsVaultTiming(params: { activationPoint: BN; currentSlot: BN }): {
  depositingPoint: BN;
  startVestingPoint: BN;
  endVestingPoint: BN;
} {
  const { activationPoint, currentSlot } = params;
  const preActivationSlots = new BN(9000);
  const closeDepositBufferSlots = new BN(750);
  const minDepositWindowSlots = new BN(3000);
  const lastJoinPoint = activationPoint.sub(preActivationSlots).sub(closeDepositBufferSlots);
  const depositingPoint = BN.min(currentSlot.add(new BN(150)), lastJoinPoint.sub(minDepositWindowSlots));

  if (depositingPoint.add(minDepositWindowSlots).gt(lastJoinPoint)) {
    throw new Error(
      "Pool activation is too soon for a valid Alpha Vault deposit window. Increase NEXT_PUBLIC_POOL_ACTIVATION_SLOTS_AHEAD (or POOL_ACTIVATION_SLOTS_AHEAD in code) or wait and retry.",
    );
  }
  if (!lastJoinPoint.gt(currentSlot)) {
    throw new Error("Pool activation has already passed or is too close — use a future activation time.");
  }

  return {
    depositingPoint,
    startVestingPoint: activationPoint.add(new BN(1)),
    endVestingPoint: activationPoint.add(new BN(1)),
  };
}

/**
 * Same as `buildCreateFcfsAlphaVaultForPoolTx` but uses known activation (no RPC pool read).
 * Use in the same transaction as `initializeCustomizablePool` so the pool account is not visible yet.
 */
export async function buildCreateFcfsAlphaVaultForBundledPoolTx(
  connection: Connection,
  input: {
    creator: PublicKey;
    pool: PublicKey;
    /** Non-SOL side of the pool (launch SPL). */
    projectMint: PublicKey;
    activationPoint: BN;
    /** Must be `0` (slot). */
    activationType: number;
    currentSlot: BN;
    launch: Pick<Collection, "supply" | "mintPriceLamports">;
  },
): Promise<{ tx: Transaction; expectedVault: PublicKey; baseMint: PublicKey; maxDepositingCap: BN }> {
  const cluster = getPublicCluster();
  const maxLamports = primarySalesVaultTargetLamports(input.launch);
  if (!maxLamports || maxLamports <= BigInt(0)) {
    throw new Error("Launch needs a positive supply and mint price to size the vault.");
  }
  const maxDepositingCap = new BN(maxLamports.toString());
  ensure(input.launch.mintPriceLamports, "Launch is missing mintPriceLamports.");

  if (input.activationType !== 0) {
    throw new Error("Bundled vault creation supports slot-based activation only.");
  }
  if (input.projectMint.equals(NATIVE_MINT)) {
    throw new Error("Project mint must not be native SOL.");
  }

  const { depositingPoint, startVestingPoint, endVestingPoint } = computeFcfsVaultTiming({
    activationPoint: input.activationPoint,
    currentSlot: input.currentSlot,
  });

  const { baseMint, quoteMint } = fcfsBaseQuoteFromDammV2Pool({
    tokenAMint: input.projectMint,
    tokenBMint: NATIVE_MINT,
  });
  const expectedVault = deriveFcfsAlphaVaultPda(input.creator, input.pool);

  const tx = await AlphaVaultSdk.createCustomizableFcfsVault(
    connection,
    {
      quoteMint,
      baseMint,
      poolAddress: input.pool,
      poolType: PoolType.DAMMV2,
      depositingPoint,
      startVestingPoint,
      endVestingPoint,
      maxDepositingCap,
      individualDepositingCap: maxDepositingCap,
      escrowFee: new BN(0),
      whitelistMode: WhitelistMode.Permissionless,
    },
    input.creator,
    { cluster },
  );

  return { tx, expectedVault, baseMint, maxDepositingCap };
}

/**
 * Loads DAMM v2 pool state and builds `initializeFcfsVault` with:
 * - `maxDepositingCap` = supply × mint price (full sellout quote deposits)
 * - `individualDepositingCap` = same (no per-wallet cumulative cap)
 * - Deposit / vesting points aligned to pool activation (slot-based pools only).
 */
export async function buildCreateFcfsAlphaVaultForPoolTx(
  connection: Connection,
  input: {
    creator: PublicKey;
    pool: PublicKey;
    launch: Pick<Collection, "supply" | "mintPriceLamports">;
  },
): Promise<{ tx: Transaction; expectedVault: PublicKey; baseMint: PublicKey; maxDepositingCap: BN }> {
  const cluster = getPublicCluster();
  const maxLamports = primarySalesVaultTargetLamports(input.launch);
  if (!maxLamports || maxLamports <= BigInt(0)) {
    throw new Error("Launch needs a positive supply and mint price to size the vault.");
  }
  const maxDepositingCap = new BN(maxLamports.toString());
  ensure(input.launch.mintPriceLamports, "Launch is missing mintPriceLamports.");

  const cpAmm = createCpAmmProgram(connection, { cluster });
  const poolPk = input.pool;
  let pool: {
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    activationPoint: BN | null;
    activationType: number;
    hasAlphaVault?: boolean;
  };
  try {
    pool = await cpAmm.account.pool.fetch(poolPk);
  } catch {
    throw new Error("Could not read this address as a Meteora DAMM v2 pool. Check the pool pubkey and cluster.");
  }

  if (pool.hasAlphaVault === false) {
    throw new Error(
      "This DAMM v2 pool was not created for Alpha Vault (hasAlphaVault is false). Use “Create pool + vault”, or a Meteora pool with Alpha Vault enabled.",
    );
  }

  const activationPoint = pool.activationPoint;
  if (!activationPoint) {
    throw new Error("Pool has no activation point — use a pool with a scheduled activation before creating an Alpha Vault.");
  }

  if (pool.activationType !== 0) {
    throw new Error(
      "Automatic vault creation currently supports slot-based activation pools only. Create the vault in Meteora for timestamp-based pools, then paste the address.",
    );
  }

  const currentSlot = new BN(await connection.getSlot("confirmed"));
  const { depositingPoint, startVestingPoint, endVestingPoint } = computeFcfsVaultTiming({
    activationPoint,
    currentSlot,
  });

  const { baseMint, quoteMint } = fcfsBaseQuoteFromDammV2Pool(pool);
  const expectedVault = deriveFcfsAlphaVaultPda(input.creator, poolPk);

  const tx = await AlphaVaultSdk.createCustomizableFcfsVault(
    connection,
    {
      quoteMint,
      baseMint,
      poolAddress: poolPk,
      poolType: PoolType.DAMMV2,
      depositingPoint,
      startVestingPoint,
      endVestingPoint,
      maxDepositingCap,
      individualDepositingCap: maxDepositingCap,
      escrowFee: new BN(0),
      whitelistMode: WhitelistMode.Permissionless,
    },
    input.creator,
    { cluster },
  );

  return { tx, expectedVault, baseMint, maxDepositingCap };
}
