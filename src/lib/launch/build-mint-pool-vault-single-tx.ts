/**
 * Paired-launch path: **new** SPL mint + full 1B supply + Metaplex token metadata
 * + DAMM v2 pool (hasAlphaVault) + FCFS Alpha Vault + **revoke mint authority**.
 *
 * **Product target:** at launch, **Slice A** (the share not in Slice B) should fund the **Meteora Alpha Vault / DAMM**
 * path; **Slice B** should land in **two PDA vaults** (creator + NFT holder) on the project mint — not the creator’s
 * personal ATA. **Current implementation:** step (1) still mints the entire supply to the **payer’s ATA** then seeds
 * the pool from the wallet; Meteora’s builder expects payer-funded liquidity. Closing this gap requires mint/split
 * under PDAs then routing Slice A into Alpha Vault seeding and Slice B into the two vaults (L1 + Meteora changes).
 *
 * Solana legacy transactions are capped at **1232 bytes**. A single bundle exceeds that, so:
 *
 * 1. **Token setup** — create mint, ATA, mint full supply, optional immutable metadata.
 * 2. **Pool only** — after (1) confirms; uses a fresh slot (pool account must exist on-chain before vault init).
 * 3. **Alpha Vault + revoke mint authority** — vault built from on-chain pool state; if still oversized, vault then
 *    revoke in two txs.
 *
 * We **always** use steps 2–3 as separate transactions (never pool+vault+revoke in one tx). Some wallets (e.g. Privy
 * embedded → Jupiter `wallet-api` broadcast) reject or 500 on large combined Meteora bundles even when under 1232B.
 *
 * Product rule: total project token supply is always **1_000_000_000** whole tokens × 10^decimals.
 */

import BN from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

import {
  POOL_ACTIVATION_SLOTS_AHEAD,
  buildCreateDammV2PoolWithAlphaVaultTx,
} from "@/lib/launch/build-create-damm-pool-for-launch-tx";
import {
  buildCreateFcfsAlphaVaultForPoolTx,
  deriveFcfsAlphaVaultPda,
} from "@/lib/launch/build-create-fcfs-alpha-vault-tx";
import { buildSplTokenMetadataInstructions } from "@/lib/launch/build-spl-token-metadata-ix";
import { buildCreateSplMintInstructions } from "@/lib/solana/create-mint-ix";
import { createUmiForEndpoint, withWalletAdapter, type WalletAdapterLike } from "@/lib/metaplex/core";
import type { Collection } from "@/types/collection";

/** Fixed project token supply (whole tokens) per product. */
export const PROJECT_TOKEN_SUPPLY_WHOLE = 1_000_000_000n;

/** Serialized legacy tx size must stay under this (wallets enforce ~1232). */
const LEGACY_TX_MAX_BYTES = 1232;

function legacyTxSerializedLen(tx: Transaction): number {
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
}

export type BuildMintPoolVaultSingleParams = {
  payer: PublicKey;
  newMintDecimals?: number;
  newMintKeypair?: Keypair;
  positionNftMint: Keypair;
  seedSolLamports: BN;
  seedProjectTokenRaw: BN;
  launch: Pick<Collection, "supply" | "mintPriceLamports">;
  tokenMetadata?: {
    wallet: WalletAdapterLike;
    slug: string;
    name: string;
    symbol: string;
    metadataOrigin: string;
  };
};

/** Pool tx, then vault (+ optional separate revoke tx if needed for size). */
export type PoolVaultRevokeBuild = {
  poolTx: Transaction;
  poolSigners: Keypair[];
  buildVaultPhaseTxs: () => Promise<
    | { kind: "one"; tx: Transaction; signers: Keypair[] }
    | { kind: "two"; vaultTx: Transaction; revokeTx: Transaction; signers: Keypair[] }
  >;
  pool: PublicKey;
  expectedVault: PublicKey;
};

export type MintPoolVaultSequence = {
  tokenSetupTx: Transaction;
  tokenSetupSigners: Keypair[];
  buildPoolVaultRevokePhase: () => Promise<PoolVaultRevokeBuild>;
  projectMint: PublicKey;
  mintKeypair: Keypair;
};

export async function buildMintPoolVaultSequence(
  connection: Connection,
  params: BuildMintPoolVaultSingleParams,
): Promise<MintPoolVaultSequence> {
  const mintKeypair = params.newMintKeypair ?? Keypair.generate();
  const projectMint = mintKeypair.publicKey;
  const newDecimals = params.newMintDecimals ?? 6;

  const totalRaw = PROJECT_TOKEN_SUPPLY_WHOLE * 10n ** BigInt(newDecimals);
  if (params.seedProjectTokenRaw.gt(new BN(totalRaw.toString()))) {
    throw new Error("Seed project tokens cannot exceed total fixed supply.");
  }

  const mintIxs = (await buildCreateSplMintInstructions(connection, params.payer, projectMint, newDecimals))
    .instructions;

  const payerAta = getAssociatedTokenAddressSync(
    projectMint,
    params.payer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const ataIxs = [
    createAssociatedTokenAccountIdempotentInstruction(
      params.payer,
      payerAta,
      params.payer,
      projectMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createMintToInstruction(projectMint, payerAta, params.payer, totalRaw, [], TOKEN_PROGRAM_ID),
  ];

  const metaIxs: import("@solana/web3.js").TransactionInstruction[] = [];
  const origin = params.tokenMetadata?.metadataOrigin?.trim();
  if (origin && params.tokenMetadata) {
    const umi = withWalletAdapter(createUmiForEndpoint(connection.rpcEndpoint), params.tokenMetadata.wallet);
    const uri = `${origin.replace(/\/$/, "")}/api/metadata/token/${params.tokenMetadata.slug}`;
    metaIxs.push(
      ...buildSplTokenMetadataInstructions(umi, {
        mint: projectMint,
        uri,
        name: params.tokenMetadata.name,
        symbol: params.tokenMetadata.symbol,
      }),
    );
  }

  const tokenSetupTx = new Transaction();
  for (const ix of mintIxs) tokenSetupTx.add(ix);
  for (const ix of ataIxs) tokenSetupTx.add(ix);
  for (const ix of metaIxs) tokenSetupTx.add(ix);
  tokenSetupTx.feePayer = params.payer;

  const { blockhash: bhToken } = await connection.getLatestBlockhash("confirmed");
  tokenSetupTx.recentBlockhash = bhToken;

  if (legacyTxSerializedLen(tokenSetupTx) > LEGACY_TX_MAX_BYTES) {
    throw new Error(
      "Token + metadata transaction is too large. Shorten token name/symbol or metadata URI, then retry.",
    );
  }

  const positionNftMint = params.positionNftMint;
  const seedSolLamports = params.seedSolLamports;
  const seedProjectTokenRaw = params.seedProjectTokenRaw;
  const launch = params.launch;
  const payer = params.payer;

  const revokeMintAuthorityIx = () =>
    createSetAuthorityInstruction(
      projectMint,
      payer,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_PROGRAM_ID,
    );

  const buildPoolVaultRevokePhase = async (): Promise<PoolVaultRevokeBuild> => {
    const slotNow = new BN(await connection.getSlot("confirmed"));
    const activationPoint = slotNow.add(new BN(POOL_ACTIVATION_SLOTS_AHEAD));

    const poolResult = await buildCreateDammV2PoolWithAlphaVaultTx(connection, {
      payer,
      projectMint,
      positionNftMint,
      seedSolLamports,
      seedProjectTokenRaw,
      projectDecimalsIfNewMint: newDecimals,
      activationPointSlots: activationPoint,
      slotNow,
    });

    const pool = poolResult.pool;
    const expectedVault = deriveFcfsAlphaVaultPda(payer, pool);

    const poolTx = new Transaction();
    for (const ix of poolResult.tx.instructions) poolTx.add(ix);
    poolTx.feePayer = payer;
    const { blockhash: bhPool } = await connection.getLatestBlockhash("confirmed");
    poolTx.recentBlockhash = bhPool;

    if (legacyTxSerializedLen(poolTx) > LEGACY_TX_MAX_BYTES) {
      throw new Error(
        "Pool creation alone exceeds the Solana legacy transaction size limit. Try fewer seed accounts or contact support.",
      );
    }

    const buildVaultPhaseTxs = async () => {
      const vaultAfterPool = await buildCreateFcfsAlphaVaultForPoolTx(connection, {
        creator: payer,
        pool,
        launch,
      });
      const combined = new Transaction();
      for (const ix of vaultAfterPool.tx.instructions) combined.add(ix);
      combined.add(revokeMintAuthorityIx());
      combined.feePayer = payer;
      const { blockhash: bhC } = await connection.getLatestBlockhash("confirmed");
      combined.recentBlockhash = bhC;

      if (legacyTxSerializedLen(combined) <= LEGACY_TX_MAX_BYTES) {
        return { kind: "one" as const, tx: combined, signers: [] as Keypair[] };
      }

      const vaultOnly = new Transaction();
      for (const ix of vaultAfterPool.tx.instructions) vaultOnly.add(ix);
      vaultOnly.feePayer = payer;
      const { blockhash: bhV } = await connection.getLatestBlockhash("confirmed");
      vaultOnly.recentBlockhash = bhV;

      const revokeOnly = new Transaction();
      revokeOnly.add(revokeMintAuthorityIx());
      revokeOnly.feePayer = payer;
      const { blockhash: bhR } = await connection.getLatestBlockhash("confirmed");
      revokeOnly.recentBlockhash = bhR;

      if (legacyTxSerializedLen(vaultOnly) > LEGACY_TX_MAX_BYTES) {
        throw new Error("Alpha Vault init alone exceeds legacy transaction size — contact support.");
      }
      if (legacyTxSerializedLen(revokeOnly) > LEGACY_TX_MAX_BYTES) {
        throw new Error("Revoke mint authority tx invalid size — contact support.");
      }
      return { kind: "two" as const, vaultTx: vaultOnly, revokeTx: revokeOnly, signers: [] as Keypair[] };
    };

    return {
      poolTx,
      poolSigners: [positionNftMint],
      buildVaultPhaseTxs,
      pool,
      expectedVault,
    };
  };

  return {
    tokenSetupTx,
    tokenSetupSigners: [mintKeypair],
    buildPoolVaultRevokePhase,
    projectMint,
    mintKeypair,
  };
}
