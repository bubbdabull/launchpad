/**
 * Alpha Vault hybrid mint (Pattern A): one user-signed transaction =
 * platform fee + Meteora Alpha Vault quote deposit + Metaplex Core Genesis
 * mint + memo. No swap leg in this path. Project SPL is not granted at mint;
 * see `genesis-pass-token-entitlement.ts` for metadata + policy notes.
 */

import AlphaVaultSdk, { WhitelistMode } from "@meteora-ag/alpha-vault";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { relaxedGenesisMintWithoutLifecycle } from "@/lib/launch/genesis-mint-config";
import { genesisPassTokenEntitlementMetadataAttributes } from "@/lib/launch/genesis-pass-token-entitlement";
import { getPlatformMintFeeLamports } from "@/lib/launch/platform-fees";
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

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

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
  const platformFeeLamports = getPlatformMintFeeLamports();

  const alphaVault = await AlphaVaultSdk.create(connection, vaultPk, {
    cluster: getPublicCluster(),
  });

  if (alphaVault.vault.whitelistMode !== WhitelistMode.Permissionless) {
    throw new Error(
      "This Alpha Vault is permissioned. Only permissionless vaults are supported in the mint flow for now.",
    );
  }

  const depositTx = await alphaVault.deposit(new BN(depositLamports.toString()), user);
  const depositInstructions = depositTx.instructions as TransactionInstruction[];

  const instructions: TransactionInstruction[] = [];

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: user,
      toPubkey: platformTreasury,
      lamports: Number(platformFeeLamports),
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
  const entryTs = Math.floor(Date.now() / 1000);
  const mint = await buildMintCoreAssetInstructions(umi, {
    collection: coreCollection,
    owner: user,
    name: `${launch.name} · Genesis Pass #${mintOrder}`,
    uri: assetUri,
    assetSigner,
    attributes: [
      /** Canonical launch identity for indexers — matches Anchor `collection_mint` PDA seed. */
      { key: "launchId", value: coreCollection.toString() },
      { key: "launch", value: launch.slug },
      { key: "mintOrder", value: String(mintOrder) },
      { key: "liquidityPath", value: "alpha_vault" },
      { key: "alphaVault", value: vaultPk.toBase58() },
      /** Participation tier at mint (on-chain program may overwrite semantics). */
      { key: "vaultTier", value: "0" },
      { key: "entryTs", value: String(entryTs) },
      { key: "vaultFillBpsAtMint", value: "0" },
      { key: "solPaidLamports", value: depositLamports.toString() },
      ...genesisPassTokenEntitlementMetadataAttributes(),
      { key: "mintedAt", value: new Date().toISOString() },
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

  instructions.push({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(`lp:${launch.slug}:#${mintOrder}`, "utf8"),
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

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
