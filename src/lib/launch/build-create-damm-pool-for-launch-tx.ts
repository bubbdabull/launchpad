/**
 * Meteora DAMM v2 customizable pool with hasAlphaVault=true (slot activation).
 * Token A = project SPL, token B = wrapped SOL (Meteora Alpha Vault expects `baseMint`/`quoteMint` to match A/B).
 * Seed liquidity must be funded by the payer wallet. **All initial position liquidity is permanently
 * locked** (`isLockLiquidity: true` → Meteora `permanentLockPosition` appended to the pool transaction).
 */

import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  CpAmm,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  deriveCustomizablePoolAddress,
  getBaseFeeParams,
} from "@meteora-ag/cp-amm-sdk";
import BN from "bn.js";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

/** Slot delta from pool-create time to DAMM activation — drives Meteora FCFS deposit window length (see `computeFcfsVaultTiming`). */
const DEFAULT_POOL_ACTIVATION_SLOTS_AHEAD = 5_000_000;

function readPoolActivationSlotsAhead(): number {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_POOL_ACTIVATION_SLOTS_AHEAD?.trim() : "";
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 30_000) return Math.min(n, 50_000_000);
  }
  return DEFAULT_POOL_ACTIVATION_SLOTS_AHEAD;
}

/**
 * Slots from “now” at pool creation until DAMM activation. Larger ⇒ longer Alpha Vault DEPOSITING window
 * (Meteora: `lastJoinPoint ≈ activation − 9750` slots, deposits from `depositingPoint` until then).
 * Override with `NEXT_PUBLIC_POOL_ACTIVATION_SLOTS_AHEAD` (min 30_000).
 */
export const POOL_ACTIVATION_SLOTS_AHEAD = readPoolActivationSlotsAhead();

async function fetchMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  try {
    return (await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID)).decimals;
  } catch {
    return (await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID)).decimals;
  }
}

async function tokenProgramForMint(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  if (mint.equals(NATIVE_MINT)) return TOKEN_PROGRAM_ID;
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) return TOKEN_PROGRAM_ID;
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

/**
 * Predict DAMM v2 customizable pool PDA for project mint + SOL (same derivation as `createCustomPool`).
 * Mints are **not** sorted by pubkey: token A = project, token B = wrapped SOL, matching Meteora’s Alpha Vault
 * DAMM v2 example (`baseMint` / `quoteMint` must equal `tokenAMint` / `tokenBMint` on the pool account).
 */
export function predictCustomPoolAddress(projectMint: PublicKey): PublicKey {
  return deriveCustomizablePoolAddress(projectMint, NATIVE_MINT);
}

export type BuildCreateDammPoolParams = {
  payer: PublicKey;
  /** SPL mint for the launch token (must not be wSOL). */
  projectMint: PublicKey;
  /** Signs the new position NFT mint; keep secret until the pool tx is submitted. */
  positionNftMint: Keypair;
  /** Lamports of SOL (wrapped) for initial pool liquidity. */
  seedSolLamports: BN;
  /** Project token amount in smallest units (≥1 if non-zero SOL seed). */
  seedProjectTokenRaw: BN;
  /**
   * When the project mint is created in the same transaction, pass decimals here
   * so we skip RPC `getMint` (account does not exist yet).
   */
  projectDecimalsIfNewMint?: number;
  /**
   * Precomputed slot timeline for bundling with Alpha Vault init in one tx.
   * When omitted, `currentSlot` is read from RPC and activation = slot + POOL_ACTIVATION_SLOTS_AHEAD.
   */
  activationPointSlots?: BN;
  slotNow?: BN;
};

/**
 * Builds `initializeCustomizablePool` with `hasAlphaVault: true`, slot-based activation, and permanent
 * liquidity lock on the opening position (Meteora DAMM v2).
 */
export async function buildCreateDammV2PoolWithAlphaVaultTx(
  connection: Connection,
  params: BuildCreateDammPoolParams,
): Promise<{ tx: Transaction; pool: PublicKey; position: PublicKey; positionNftMint: Keypair }> {
  if (params.projectMint.equals(NATIVE_MINT)) {
    throw new Error("Project mint must not be native SOL.");
  }
  if (params.seedSolLamports.lte(new BN(0)) && params.seedProjectTokenRaw.lte(new BN(0))) {
    throw new Error("Provide a positive seed for SOL and/or project tokens.");
  }

  const tokenAMint = params.projectMint;
  const tokenBMint = NATIVE_MINT;
  const tokenAAmount = params.seedProjectTokenRaw;
  const tokenBAmount = params.seedSolLamports;

  const projectDecimals =
    params.projectDecimalsIfNewMint !== undefined
      ? params.projectDecimalsIfNewMint
      : await fetchMintDecimals(connection, params.projectMint);
  const tokenAProgram = await tokenProgramForMint(connection, tokenAMint);
  const tokenBProgram = await tokenProgramForMint(connection, tokenBMint);

  const cpAmm = new CpAmm(connection);
  const { initSqrtPrice, liquidityDelta } = cpAmm.preparePoolCreationParams({
    tokenAAmount,
    tokenBAmount,
    minSqrtPrice: MIN_SQRT_PRICE,
    maxSqrtPrice: MAX_SQRT_PRICE,
    collectFeeMode: CollectFeeMode.BothToken,
  });

  const tokenBDecimals = 9;
  const baseFee = getBaseFeeParams(
    {
      baseFeeMode: BaseFeeMode.FeeTimeSchedulerExponential,
      feeTimeSchedulerParam: {
        startingFeeBps: 500,
        endingFeeBps: 30,
        numberOfPeriod: 24,
        totalDuration: 3600,
      },
    },
    tokenBDecimals,
    ActivationType.Slot,
  );

  const poolFees = {
    baseFee,
    compoundingFeeBps: 0,
    padding: 0,
    dynamicFee: null,
  };

  const slotNow = params.slotNow ?? new BN(await connection.getSlot("confirmed"));
  const activationPoint =
    params.activationPointSlots ?? slotNow.add(new BN(POOL_ACTIVATION_SLOTS_AHEAD));

  const { tx, pool, position } = await cpAmm.createCustomPool({
    payer: params.payer,
    creator: params.payer,
    positionNft: params.positionNftMint.publicKey,
    tokenAMint,
    tokenBMint,
    tokenAAmount,
    tokenBAmount,
    sqrtMinPrice: MIN_SQRT_PRICE,
    sqrtMaxPrice: MAX_SQRT_PRICE,
    initSqrtPrice,
    liquidityDelta,
    poolFees,
    hasAlphaVault: true,
    collectFeeMode: CollectFeeMode.BothToken,
    activationPoint,
    activationType: ActivationType.Slot,
    tokenAProgram,
    tokenBProgram,
    /** Seeded LP is non-withdrawable from this position — enforced by Meteora in the same signature as pool init. */
    isLockLiquidity: true,
  });

  const expectedPool = predictCustomPoolAddress(params.projectMint);
  if (!pool.equals(expectedPool)) {
    throw new Error("Pool address mismatch — aborting for safety.");
  }

  return { tx, pool, position, positionNftMint: params.positionNftMint };
}
