/**
 * Alpha Vault hybrid mint (Pattern A): one user-signed transaction =
 * platform fee + Meteora Alpha Vault quote deposit + Metaplex Core Genesis
 * mint (+ optional Anchor participation ix). No swap leg in this path.
 * Optional v0 address lookup tables shrink the message (see env in `.env.example`).
 */

import AlphaVaultSdk, { WhitelistMode } from "@meteora-ag/alpha-vault";
import BN from "bn.js";
import {
  type AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { relaxedGenesisMintWithoutLifecycle } from "@/lib/launch/genesis-mint-config";
import { genesisMintTaxTotalLamports } from "@/lib/launch/genesis-mint-tax";
import {
  buildMintCoreAssetInstructions,
  createUmiForEndpoint,
  withWalletAdapter,
  type WalletAdapterLike,
} from "@/lib/metaplex/core";
import { getPublicCluster } from "@/lib/solana/cluster-public";
import type { Collection } from "@/types/collection";
import { generateSigner } from "@metaplex-foundation/umi";
import { buildRecordGenesisParticipationIx, fetchDecodedLaunchState, LC_MINT_ACTIVE } from "@/lib/launch-controller";

/**
 * Optional comma/space-separated ALT addresses (`NEXT_PUBLIC_SOLANA_MINT_ADDRESS_LOOKUP_TABLES`).
 * Populate tables with Meteora + Metaplex Core + SPL programs used by your vault path to shrink v0 messages.
 */
async function fetchMintLookupTables(connection: Connection): Promise<AddressLookupTableAccount[]> {
  const raw = process.env.NEXT_PUBLIC_SOLANA_MINT_ADDRESS_LOOKUP_TABLES?.trim();
  if (!raw) return [];
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const out: AddressLookupTableAccount[] = [];
  for (const s of parts) {
    try {
      const pk = new PublicKey(s);
      const res = await connection.getAddressLookupTable(pk);
      if (res.value) out.push(res.value);
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

/** Ultra-compact on-chain name — full title lives in `/api/metadata/asset/...` JSON. */
function compactOnChainAssetName(mintOrder: number): string {
  return `G#${mintOrder}`;
}

export type AlphaVaultHybridMintInput = {
  user: PublicKey;
  wallet: WalletAdapterLike;
  launch: Collection & { slug: string };
  mintOrder: number;
  mintPriceLamportsOverride?: bigint;
};

export type AlphaVaultHybridMintResult = {
  tx: VersionedTransaction;
  asset: PublicKey;
  /** Max quote (e.g. SOL) deposited into the vault for this mint. */
  depositQuoteLamports: bigint;
};

function ensure<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(msg);
  return v;
}

export async function buildAlphaVaultHybridMintTx(
  connection: Connection,
  input: AlphaVaultHybridMintInput,
): Promise<AlphaVaultHybridMintResult> {
  const { launch, user, wallet, mintOrder } = input;

  const platformTreasuryStr = ensure(
    process.env.NEXT_PUBLIC_PLATFORM_TREASURY,
    "Missing NEXT_PUBLIC_PLATFORM_TREASURY in env.",
  );
  const platformTreasury = new PublicKey(platformTreasuryStr);

  const vaultPk = new PublicKey(
    ensure(launch.alphaVault, "Launch is missing alphaVault. Set the Meteora Alpha Vault address on the collection."),
  );
  const coreCollection = new PublicKey(
    ensure(
      launch.coreCollection,
      "Launch is missing coreCollection. Has the Genesis Pass collection been created yet?",
    ),
  );

  const depositLamports =
    input.mintPriceLamportsOverride ??
    ensure(launch.mintPriceLamports, "Launch is missing mintPriceLamports.");
  const genesisMintTaxLamports = genesisMintTaxTotalLamports(depositLamports);

  const alphaVault = await AlphaVaultSdk.create(connection, vaultPk, {
    cluster: getPublicCluster(),
  });

  if (alphaVault.vault.whitelistMode !== WhitelistMode.Permissionless) {
    throw new Error(
      "This Alpha Vault is permissioned. Only permissionless vaults are supported in the mint flow for now.",
    );
  }

  const interaction = await alphaVault.interactionState(null, null);
  if (!interaction.canDeposit) {
    const vp = alphaVault.vaultPoint;
    const stateLabels = ["PREPARING", "DEPOSITING", "PURCHASING", "LOCKING", "VESTING", "ENDED"] as const;
    const st = alphaVault.vaultState;
    const slot = await connection.getSlot("confirmed");
    throw new Error(
      `This Alpha Vault cannot take deposits now (state: ${stateLabels[st] ?? String(st)}, current slot ~${slot}). ` +
        `FCFS deposits are only allowed between slots ~${vp.firstJoinPoint} and ~${vp.lastJoinPoint}. ` +
        `If that window has ended, Meteora returns error 6004 (NotPermitThisActionInThisTimePoint). ` +
        `For new launches, set NEXT_PUBLIC_POOL_ACTIVATION_SLOTS_AHEAD to a larger value (see .env.example) and recreate the pool + Alpha Vault, then update the launch record.`,
    );
  }

  const depositTx = await alphaVault.deposit(new BN(depositLamports.toString()), user);
  const depositInstructions = depositTx.instructions as TransactionInstruction[];

  const instructions: TransactionInstruction[] = [];

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: user,
      toPubkey: platformTreasury,
      lamports: Number(genesisMintTaxLamports),
    }),
  );
  instructions.push(...depositInstructions);

  // Anchor mint receipt: only when lifecycle is MINT_ACTIVE (unless relaxed mode omits it).
  const decodedLaunch = await fetchDecodedLaunchState(connection, coreCollection).catch(() => null);
  const relax = relaxedGenesisMintWithoutLifecycle();
  const includeParticipationIx = (() => {
    if (!decodedLaunch) return false;
    if (decodedLaunch.lifecycle < LC_MINT_ACTIVE) return false;
    if (decodedLaunch.expectedQuotePerMint !== depositLamports) return false;
    return true;
  })();

  if (!relax) {
    if (!decodedLaunch) {
      throw new Error(
        "Launch is missing on-chain wiring (LaunchState). Creator must initialize the launch lifecycle before minting.",
      );
    }
    if (decodedLaunch.lifecycle < LC_MINT_ACTIVE) {
      throw new Error("This launch is not yet mint-active on-chain.");
    }
    if (decodedLaunch.expectedQuotePerMint !== depositLamports) {
      throw new Error("Mint price does not match on-chain expected_quote_per_mint.");
    }
  } else if (decodedLaunch && decodedLaunch.expectedQuotePerMint !== depositLamports) {
    throw new Error("Mint price does not match on-chain expected_quote_per_mint.");
  }

  const umi = withWalletAdapter(createUmiForEndpoint(connection.rpcEndpoint), wallet);
  const assetSigner = generateSigner(umi);
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!origin) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL to your public site URL so NFT metadata URIs resolve for indexers.",
    );
  }
  const assetUri = `${origin}/api/metadata/asset/${assetSigner.publicKey}`;
  const mint = await buildMintCoreAssetInstructions(umi, {
    collection: coreCollection,
    owner: user,
    name: compactOnChainAssetName(mintOrder),
    uri: assetUri,
    assetSigner,
    /** One Attributes entry — `/api/metadata/asset` resolves slug; JSON adds the rest. Saves v0 message bytes. */
    attributes: [
      { key: "launch", value: launch.slug },
      /** Off-chain mirror hint for metadata / marketplaces — not used for claim math. */
      { key: "mintOrder", value: String(mintOrder) },
      { key: "mintSupply", value: String(launch.supply) },
    ],
  });
  instructions.push(...mint.instructions);

  if (includeParticipationIx && decodedLaunch) {
    instructions.push(
      buildRecordGenesisParticipationIx({
        user,
        collectionMint: coreCollection,
        assetMint: mint.asset,
        depositLamports,
        vaultTier: 0,
        depositSeq: decodedLaunch.depositSeq,
      }),
    );
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const lookupTableAccounts = await fetchMintLookupTables(connection);
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTableAccounts.length > 0 ? lookupTableAccounts : undefined);

  try {
    message.serialize();
  } catch (err) {
    const hint =
      err instanceof RangeError && String(err.message).includes("overruns Uint8Array")
        ? " Solana’s single-transaction size limit was exceeded. Add NEXT_PUBLIC_SOLANA_MINT_ADDRESS_LOOKUP_TABLES (Meteora + Core + SPL program accounts), shorten the launch slug, or contact support to split this bundle."
        : "";
    throw new Error(`Could not serialize mint transaction.${hint}`);
  }

  const tx = new VersionedTransaction(message);

  if (mint.signers.length > 0) {
    const keypairs = mint.signers
      .map((s) => {
        const secret = (s as unknown as { secretKey?: Uint8Array }).secretKey;
        if (!secret) return null;
        return Keypair.fromSecretKey(secret);
      })
      .filter((k): k is Keypair => k !== null);
    if (keypairs.length > 0) tx.sign(keypairs);
  }

  return {
    tx,
    asset: mint.asset,
    depositQuoteLamports: depositLamports,
  };
}
