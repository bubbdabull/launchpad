"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, Keypair, PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";
import BN from "bn.js";

import { ProtocolLayersHint } from "@/components/protocol/ProtocolLayersHint";
import { useConnectFlow } from "@/lib/auth/use-connect-flow";
import { buildMintPoolVaultSequence } from "@/lib/launch/build-mint-pool-vault-single-tx";
import { buildDeployCollectionTx } from "@/lib/launch/build-deploy-collection-tx";
import { launchMintSetupComplete } from "@/lib/launch/launch-on-chain";
import { lamportsToSolString, primarySalesVaultTargetLamports } from "@/lib/launch/vault-economics";
import { MAX_SLICE_B_RESERVE_BPS, MAX_SLICE_B_RESERVE_PCT } from "@/lib/launch/slice-b-reserve";
import { explorerUrl } from "@/lib/solana/cluster-public";
import { solanaPubkeysEqual } from "@/lib/solana/pubkey-eq";
import { sendLegacyTransactionPreferRpc } from "@/lib/solana/send-legacy-tx-prefer-rpc";
import type { Collection } from "@/types/collection";
import {
  buildAdvanceLifecycleIx,
  buildInitializeLaunchIx,
  buildSetAlphaVaultIx,
  decodeLaunchStateAccountData,
  fetchDecodedLaunchState,
  LC_DRAFT,
  LC_MINT_ACTIVE,
  LC_VAULT_OPEN,
  launchStatePda,
} from "@/lib/launch-controller";
import type { WalletAdapterLike } from "@/lib/metaplex/core";

type Props = { collection: Collection };

type StepStatus = "idle" | "running" | "done" | "error";
type Step = {
  label: string;
  status: StepStatus;
  signature?: string;
  message?: string;
};

function stringifyUnknownErr(err: unknown, maxLen = 2500): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const k of ["message", "msg", "reason", "error"] as const) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object" && "message" in (v as object)) {
        const im = (v as { message?: unknown }).message;
        if (typeof im === "string" && im.trim()) return im;
      }
    }
    try {
      const j = JSON.stringify(err);
      if (j && j !== "{}") return j.length > maxLen ? `${j.slice(0, maxLen)}…` : j;
    } catch {
      /* ignore */
    }
  }
  const s = String(err);
  return s === "[object Object]" ? "Unknown error (wallet or RPC returned a non-Error object — check the browser console)." : s;
}

async function formatDeploySendError(err: unknown, connection: Connection): Promise<string> {
  let m = stringifyUnknownErr(err);
  if (err instanceof SendTransactionError) {
    try {
      const logs = await err.getLogs(connection);
      if (logs?.length) m += `\n\nSimulation logs:\n${logs.join("\n")}`;
    } catch {
      // RPC may not return logs; keep the original message.
    }
    const le = (err as SendTransactionError & { logs?: string[] }).logs;
    if (Array.isArray(le) && le.length && !m.includes("Simulation logs:")) {
      m += `\n\nSimulation logs:\n${le.join("\n")}`;
    }
  }
  if (!m.trim()) {
    m = "Transaction failed with no message from the wallet or RPC. Try Phantom/Solflare, confirm you are on devnet, and check the browser console (F12 → Console) on retry.";
  }
  const lower = m.toLowerCase();
  if (
    lower.includes("jup.ag") ||
    lower.includes("wallet-api") ||
    lower.includes("broadcast") ||
    /\b500\b/.test(m)
  ) {
    return `${m}\n\nThe deploy flow now signs in your wallet and broadcasts through this app’s Solana RPC (not Jupiter) when \`signTransaction\` is available — retry once. If it still fails, use Phantom or Solflare with the same creator key.`;
  }
  return m;
}

export function DeployOnChainPanel({ collection: c }: Props) {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const openConnect = useConnectFlow();

  const alphaDone = !!c.alphaVault;
  const needsCollection = !c.coreCollection;
  const [anchorLifecycle, setAnchorLifecycle] = useState<number | null>(null);

  const anchorMintActive =
    anchorLifecycle != null && anchorLifecycle >= LC_MINT_ACTIVE;

  const allDone = launchMintSetupComplete(c) && anchorMintActive;

  const [poolVaultBusy, setPoolVaultBusy] = useState(false);
  const [seedSol, setSeedSol] = useState("0.1");
  const [seedTokens, setSeedTokens] = useState("1000");
  const [newMintDecimals, setNewMintDecimals] = useState("6");
  const [steps, setSteps] = useState<Step[]>([
    { label: "Project SPL mint · pool · Alpha Vault", status: alphaDone ? "done" : "idle" },
    { label: "Core collection (Genesis Pass)", status: needsCollection ? "idle" : "done" },
    { label: "Anchor · project SPL + MINT_ACTIVE", status: "idle" },
  ]);
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  /**
   * `postDeploy` persists to Supabase, then we often run the next on-chain step in the same click
   * before `router.refresh()` re-renders this panel with updated `collection`. Merge successful
   * deploy writes here so `wireAnchorLifecycle` sees the new `coreCollection` / `tokenMint` / `alphaVault`.
   */
  const lastDeployPersisted = useRef<Partial<Pick<Collection, "coreCollection" | "alphaVault" | "tokenMint">>>({});

  // Sync steps 0–1 from launch record only. Do **not** reset step 3 here: `anchorBusy` toggles around
  // Anchor txs and would clear "running" / `catch` error state before `findIndex` runs, hiding messages.
  useEffect(() => {
    setSteps((prev) => {
      const anchor = prev[2] ?? {
        label: "Anchor · project SPL + MINT_ACTIVE",
        status: "idle" as StepStatus,
      };
      return [
        {
          label: "Project SPL mint · pool · Alpha Vault",
          status: alphaDone ? "done" : "idle",
          signature: alphaDone ? prev[0]?.signature : undefined,
          message: alphaDone ? undefined : prev[0]?.message,
        },
        {
          label: "Core collection (Genesis Pass)",
          status: needsCollection ? "idle" : "done",
          signature: !needsCollection ? prev[1]?.signature : undefined,
          message: needsCollection ? prev[1]?.message : undefined,
        },
        anchor,
      ];
    });
  }, [alphaDone, needsCollection]);

  useEffect(() => {
    if (!anchorMintActive) return;
    setSteps((prev) =>
      prev.map((s, i) =>
        i === 2 ? { ...s, status: "done" as const, message: undefined } : s,
      ),
    );
  }, [anchorMintActive]);

  const syncAnchorLifecycleFromPersisted = useCallback(async () => {
    const persisted = lastDeployPersisted.current;
    const core = c.coreCollection ?? persisted.coreCollection;
    const token = c.tokenMint ?? persisted.tokenMint;
    if (!core || !token) {
      setAnchorLifecycle(null);
      return;
    }
    try {
      const decoded = await fetchDecodedLaunchState(connection, new PublicKey(core));
      setAnchorLifecycle(decoded.lifecycle);
    } catch {
      setAnchorLifecycle(null);
    }
  }, [connection, c.coreCollection, c.tokenMint]);

  useEffect(() => {
    void syncAnchorLifecycleFromPersisted();
  }, [syncAnchorLifecycleFromPersisted]);

  const connectedPk = wallet.publicKey ?? null;
  const canDeploy =
    wallet.connected && connectedPk != null && solanaPubkeysEqual(c.creatorWallet, connectedPk);

  const vaultSelloutTarget = useMemo(() => primarySalesVaultTargetLamports(c), [c.supply, c.mintPriceLamports]);

  const sliceSummary = useMemo(() => {
    const b = Math.max(0, Math.min(MAX_SLICE_B_RESERVE_PCT, c.sliceBPct ?? 0));
    const a = 100 - b;
    const creatorOfB = Math.max(0, Math.min(100, c.sliceBCreatorSharePct ?? 50));
    return { sliceAPct: a, sliceBPct: b, creatorOfB };
  }, [c.sliceBPct, c.sliceBCreatorSharePct]);

  const buttonLabel = useMemo(() => {
    if (allDone) return "Launch is live on-chain ✓";
    if (busy) return "Deploying…";
    if (!wallet.connected) return "Connect creator wallet";
    if (!connectedPk || !solanaPubkeysEqual(c.creatorWallet, connectedPk)) return "Connect creator wallet";
    if (alphaDone && needsCollection) return "Resume — step 2 (Core)";
    return "Continue setup";
  }, [allDone, busy, wallet.connected, connectedPk, c.creatorWallet, alphaDone, needsCollection]);

  function patchStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function postDeploy(payload: Record<string, string>): Promise<void> {
    const r = await fetch(`/api/launches/${c.slug}/deploy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message ?? `Server error ${r.status}`);
    }
    const p = lastDeployPersisted.current;
    if (payload.alphaVault) p.alphaVault = payload.alphaVault;
    if (payload.coreCollection) p.coreCollection = payload.coreCollection;
    if (payload.tokenMint) p.tokenMint = payload.tokenMint;
    void syncAnchorLifecycleFromPersisted();
  }

  /** Re-read Supabase mirrors into the ref so Anchor wiring works after a refresh or cold open. */
  async function refreshDeployMirrorsIntoRef(): Promise<void> {
    try {
      const r = await fetch(`/api/launches/${c.slug}/deploy`, { method: "GET", cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as {
        ok?: boolean;
        coreCollection?: string | null;
        alphaVault?: string | null;
        tokenMint?: string | null;
      };
      if (!j.ok) return;
      const p = lastDeployPersisted.current;
      const assign = (v: string | null | undefined, key: "coreCollection" | "alphaVault" | "tokenMint") => {
        const t = typeof v === "string" ? v.trim() : "";
        if (t.length >= 32) p[key] = t;
      };
      assign(j.coreCollection, "coreCollection");
      assign(j.alphaVault, "alphaVault");
      assign(j.tokenMint, "tokenMint");
    } catch {
      /* ignore */
    }
  }

  function firstDeployAddress(...candidates: (string | undefined | null)[]): string | undefined {
    for (const x of candidates) {
      const t = typeof x === "string" ? x.trim() : "";
      if (t.length >= 32) return t;
    }
    return undefined;
  }

  function secondsPerMonth(): bigint {
    // Deterministic approximation used for on-chain cliff + vesting seconds.
    // (Update only if you also update anchor decoding/expectations.)
    return BigInt(30 * 24 * 3600);
  }

  async function wireAnchorLifecycle(): Promise<void> {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error("Connect creator wallet first.");
    }
    await refreshDeployMirrorsIntoRef();
    const persisted = lastDeployPersisted.current;
    const coreCollection = firstDeployAddress(c.coreCollection, persisted.coreCollection);
    const alphaVaultAddr = firstDeployAddress(c.alphaVault, persisted.alphaVault);
    const tokenMintAddr = firstDeployAddress(c.tokenMint, persisted.tokenMint);
    if (!coreCollection || !alphaVaultAddr || !tokenMintAddr) {
      throw new Error(
        "Missing coreCollection, Alpha Vault, or project SPL mint (tokenMint). Finish steps 1–2 first, sign in with the creator wallet, then retry.",
      );
    }
    if (!wallet.publicKey || !solanaPubkeysEqual(c.creatorWallet, wallet.publicKey)) {
      throw new Error("Connect with the creator wallet that published this launch.");
    }
    const creator = wallet.publicKey;
    const corePk = new PublicKey(coreCollection);
    const alphaVaultPk = new PublicKey(alphaVaultAddr);
    const projectMintPk = new PublicKey(tokenMintAddr);

    if (c.mintPriceLamports == null || c.mintPriceLamports <= 0n) {
      throw new Error("Missing mintPriceLamports.");
    }
    if (!Number.isFinite(c.supply) || c.supply <= 0) {
      throw new Error("Missing / invalid supply.");
    }

    const cliffMonths = c.creatorVestingCliffMonths ?? 0;
    const periodMonths = c.creatorVestingPeriodMonths ?? 12;
    const vestingSupplyPct = c.creatorVestingSupplyPct ?? 0;
    const tokenHolderPct = c.tokenHolderRewardPct ?? 0;

    const expQuotePerMint = c.mintPriceLamports;
    const supplyInt = BigInt(Math.max(0, Math.floor(c.supply)));
    const seconds = secondsPerMonth();
    const cliffSeconds = BigInt(Math.max(0, Math.round(cliffMonths))) * seconds;
    const vestingSeconds = BigInt(Math.max(1, Math.round(periodMonths))) * seconds;

    // Map deposited quote into holder allocation via tokens-per-quote ratio:
    // allocation_per_pass = tokensToHolders / supply
    const TOTAL_TOKEN_SUPPLY = 1_000_000_000n;
    const lockedTokens = (TOTAL_TOKEN_SUPPLY * BigInt(Math.max(0, Math.min(50, Math.round(vestingSupplyPct))))) / 100n;
    const tokensToHolders = (lockedTokens * BigInt(Math.max(0, Math.min(100, Math.round(tokenHolderPct)))))/ 100n;

    const tokensPerQuoteNum = tokensToHolders;
    const tokensPerQuoteDen = expQuotePerMint * supplyInt;
    if (tokensPerQuoteDen <= 0n) {
      throw new Error("Invalid tokens-per-quote denominator (expected_quote_per_mint * supply).");
    }

    const [launchStatePk] = launchStatePda(corePk);
    const info = await connection.getAccountInfo(launchStatePk, "confirmed");
    let lifecycle = info?.data ? decodeLaunchStateAccountData(Buffer.from(info.data)).lifecycle : null;

    const instructions: Transaction[] = [];
    const tx = new Transaction();
    tx.feePayer = creator;

    // Note: We keep the lifecycle progression deterministic for mint:
    // DRAFT -> VAULT_OPEN -> MINT_ACTIVE
    const ixSetVault = buildSetAlphaVaultIx({
      authority: creator,
      collectionMint: corePk,
      alphaVault: alphaVaultPk,
    });
    const ixAdvance = buildAdvanceLifecycleIx({
      authority: creator,
      collectionMint: corePk,
      next: LC_MINT_ACTIVE,
    });

    if (lifecycle == null) {
      const sliceBReserveBps = Math.max(0, Math.min(MAX_SLICE_B_RESERVE_BPS, Math.round((c.sliceBPct ?? 0) * 100)));
      const sliceBCreatorOfReserveBps = Math.max(
        0,
        Math.min(10_000, Math.round((c.sliceBCreatorSharePct ?? 50) * 100)),
      );

      const ixInit = await buildInitializeLaunchIx({
        authority: creator,
        collectionMint: corePk,
        projectMint: projectMintPk,
        cliffSeconds,
        vestingSeconds,
        expectedQuotePerMint: expQuotePerMint,
        tokensPerQuoteNum,
        tokensPerQuoteDen,
        genesisSupply: supplyInt,
        sliceBReserveBps,
        sliceBCreatorOfReserveBps,
      });
      tx.add(ixInit, ixSetVault, ixAdvance);
    } else if (lifecycle === LC_DRAFT) {
      // Account exists but lifecycle never advanced (e.g. partial / external init only). Skip init — it would fail as "already in use".
      tx.add(ixSetVault, ixAdvance);
    } else if (lifecycle === LC_VAULT_OPEN) {
      const ixAdvance = buildAdvanceLifecycleIx({
        authority: creator,
        collectionMint: corePk,
        next: LC_MINT_ACTIVE,
      });
      tx.add(ixAdvance);
    } else if (lifecycle >= LC_MINT_ACTIVE) {
      setAnchorLifecycle(lifecycle);
      patchStep(2, { status: "done" });
      router.refresh();
      return;
    } else {
      throw new Error(`Unexpected LaunchState lifecycle (${String(lifecycle)}).`);
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    const sig = await sendLegacyTransactionPreferRpc(wallet, connection, tx);
    await connection.confirmTransaction(sig, "confirmed");
    patchStep(2, { status: "done", signature: sig });
    router.refresh();
    // Refresh lifecycle cache.
    const decoded = await fetchDecodedLaunchState(connection, corePk).catch(() => null);
    setAnchorLifecycle(decoded?.lifecycle ?? null);
  }

  async function createPoolAndVaultAutomatic() {
    setTopError(null);
    if (!wallet.connected || !wallet.publicKey) {
      openConnect();
      return;
    }
    if (!wallet.publicKey || !solanaPubkeysEqual(c.creatorWallet, wallet.publicKey)) {
      setTopError("Connect with the creator wallet that published this launch.");
      return;
    }
    if (!vaultSelloutTarget) {
      setTopError("This launch needs supply and a flat mint price before creating a vault.");
      return;
    }

    const solN = Number(seedSol);
    const tokN = Number(seedTokens);
    if (!Number.isFinite(solN) || solN <= 0) {
      setTopError("Seed SOL must be a positive number (e.g. 0.1).");
      return;
    }
    if (!Number.isFinite(tokN) || tokN <= 0) {
      setTopError("Seed token amount must be a positive number.");
      return;
    }

    const decParsed = Number.parseInt(newMintDecimals, 10);
    if (!Number.isFinite(decParsed) || decParsed < 0 || decParsed > 9) {
      setTopError("Project token decimals must be an integer 0–9.");
      return;
    }

    setPoolVaultBusy(true);
    try {
      const tokenDecimals = decParsed;
      const seedSolLamports = new BN(Math.round(solN * 1_000_000_000));
      const seedProjectTokenRaw = new BN(Math.floor(tokN * 10 ** tokenDecimals));

      const positionNft = Keypair.generate();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const tokenMetadata = origin
        ? {
            wallet: wallet as unknown as WalletAdapterLike,
            slug: c.slug,
            name: c.name,
            symbol: (c.tokenSymbol ?? "TOKEN").toUpperCase().slice(0, 10),
            metadataOrigin: origin,
          }
        : undefined;

      const seq = await buildMintPoolVaultSequence(connection, {
        payer: wallet.publicKey,
        newMintDecimals: decParsed,
        positionNftMint: positionNft,
        seedSolLamports,
        seedProjectTokenRaw,
        launch: c,
        tokenMetadata,
      });

      if (!wallet.sendTransaction && typeof wallet.signTransaction !== "function") {
        throw new Error("Wallet does not support sendTransaction or signTransaction.");
      }

      const sigToken = await sendLegacyTransactionPreferRpc(wallet, connection, seq.tokenSetupTx, {
        signers: seq.tokenSetupSigners,
      });
      await connection.confirmTransaction(sigToken, "confirmed");

      const poolPhase = await seq.buildPoolVaultRevokePhase();

      const sigPool = await sendLegacyTransactionPreferRpc(wallet, connection, poolPhase.poolTx, {
        signers: poolPhase.poolSigners,
      });
      await connection.confirmTransaction(sigPool, "confirmed");

      const vaultPart = await poolPhase.buildVaultPhaseTxs();
      let sigLast: string;
      if (vaultPart.kind === "one") {
        sigLast = await sendLegacyTransactionPreferRpc(wallet, connection, vaultPart.tx, {
          signers: vaultPart.signers,
        });
        await connection.confirmTransaction(sigLast, "confirmed");
      } else {
        const sigVault = await sendLegacyTransactionPreferRpc(wallet, connection, vaultPart.vaultTx, {
          signers: vaultPart.signers,
        });
        await connection.confirmTransaction(sigVault, "confirmed");
        sigLast = await sendLegacyTransactionPreferRpc(wallet, connection, vaultPart.revokeTx, {
          signers: vaultPart.signers,
        });
        await connection.confirmTransaction(sigLast, "confirmed");
      }

      // `damm_pool` in Supabase is routing/explorer metadata only — never lifecycle authority.
      await postDeploy({
        alphaVault: poolPhase.expectedVault.toBase58(),
        dammPool: poolPhase.pool.toBase58(),
        tokenMint: seq.projectMint.toBase58(),
      });

      patchStep(0, { status: "done", signature: sigLast });
      router.refresh();
    } catch (err: unknown) {
      setTopError(await formatDeploySendError(err, connection));
    } finally {
      setPoolVaultBusy(false);
    }
  }

  async function runDeploy() {
    setTopError(null);

    if (!wallet.connected || !wallet.publicKey) {
      openConnect();
      return;
    }
    if (!wallet.publicKey || !solanaPubkeysEqual(c.creatorWallet, wallet.publicKey)) {
      setTopError("Connect with the creator wallet that published this launch.");
      return;
    }
    if (!alphaDone) {
      setTopError(
        "Finish step 1: create the project SPL mint (1B supply + metadata), pool, and Alpha Vault before the Genesis Pass.",
      );
      return;
    }

    setBusy(true);
    let attemptedAnchor = false;
    try {
      if (needsCollection) {
        patchStep(1, { status: "running", message: undefined });
        const built = await buildDeployCollectionTx(connection, {
          payer: wallet.publicKey,
          wallet: wallet as unknown as Parameters<typeof buildDeployCollectionTx>[1]["wallet"],
          name: `${c.name} — Genesis Pass`,
          uri: `${window.location.origin}/api/metadata/collection/${c.slug}`,
        });

        const sig = await sendLegacyTransactionPreferRpc(wallet, connection, built.tx, {
          signers: built.signers,
        });
        await connection.confirmTransaction(sig, "confirmed");

        await postDeploy({
          coreCollection: built.addresses.coreCollection,
          collectionSignature: sig,
        });

        patchStep(1, { status: "done", signature: sig });
      }

      // On-chain monetization / lifecycle wiring must happen once core+alpha exist.
      if (!anchorMintActive) {
        attemptedAnchor = true;
        patchStep(2, { status: "running", message: undefined });
        await wireAnchorLifecycle();
      }

      router.refresh();
    } catch (err: unknown) {
      const message = await formatDeploySendError(err, connection);
      setTopError(message);
      setSteps((prev) => {
        let idx = prev.findIndex((s) => s.status === "running");
        if (idx === -1 && attemptedAnchor) idx = 2;
        if (idx === -1) return prev;
        return prev.map((s, i) => (i === idx ? { ...s, status: "error", message } : s));
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="deploy-on-chain"
      className="scroll-mt-24 rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.05] to-transparent p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent">Creator setup</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white">
            {allDone ? "On-chain setup complete" : "Deploy · token, pool, vault, then collection"}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            {allDone
              ? "Token mint, DAMM v2 pool, Alpha Vault, and Core collection are linked on this launch."
              : "Step 1: three or four on-chain signatures — token + metadata, then DAMM pool, then Alpha Vault (+ mint revoke in a separate tx only if size requires it). Step 2: Core Genesis Pass collection. Step 3: Anchor advances to MINT_ACTIVE. Genesis mint stays gated until vault + collection exist."}
          </p>

          <ProtocolLayersHint className="mt-4" />

          <div className="mt-4 space-y-3 rounded-xl border border-line/80 bg-panel/50 p-4">
            {vaultSelloutTarget ? (
              <div className="rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Automatic vault cap (NFT sales)</p>
                <p className="mt-1 text-sm text-white">
                  <span className="font-semibold text-accent">{lamportsToSolString(vaultSelloutTarget)}</span>
                  <span className="text-white/80">
                    {" "}
                    max quote deposits (supply × mint price) if all {c.supply.toLocaleString()} passes mint
                  </span>
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Step 1 · Project SPL + liquidity + vault</p>

              {!alphaDone ? (
                <div className="mt-2 space-y-3">
                  <p className="text-xs text-muted">
                    Split on purpose for Solana size limits and wallet broadcasters (e.g. Privy → Jupiter): first
                    signature creates the SPL mint, mints the fixed 1B supply, and writes immutable Metaplex metadata.
                    Second creates the DAMM v2 pool. Third creates the FCFS Alpha Vault and revokes mint authority in
                    one go when it fits; otherwise you&apos;ll get a fourth signature for revoke only. Anchor step 3
                    records the same 1B economics including Slice B ({sliceSummary.sliceBPct}% reserve, creator{" "}
                    {sliceSummary.creatorOfB}% of that reserve).
                  </p>
                  <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-muted">
                    <p className="font-medium text-emerald-200/95">Supply &amp; locked pool liquidity</p>
                    <p className="mt-1">
                      <strong className="text-white/90">Mint authority is revoked</strong> after the vault step so the
                      1B project token supply is fixed forever — no hidden mints. The DAMM v2 pool transaction includes
                      Meteora&apos;s <strong className="text-white/90">permanent liquidity lock</strong> on the opening
                      position — seeded LP cannot be withdrawn from that position later.
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-black/25 px-3 py-2 text-[11px] text-muted">
                    <p className="font-medium text-white/90">1B split (from launch settings)</p>
                    <p className="mt-1">
                      Slice A (vault / LP path):{" "}
                      <span className="font-mono text-accent">{sliceSummary.sliceAPct}%</span> · Slice B reserve:{" "}
                      <span className="font-mono text-accent">{sliceSummary.sliceBPct}%</span> · Within Slice B,
                      creator: <span className="font-mono text-white">{sliceSummary.creatorOfB}%</span>, holders:{" "}
                      <span className="font-mono text-white">{100 - sliceSummary.creatorOfB}%</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-muted">Project token decimals</label>
                    <input
                      value={newMintDecimals}
                      onChange={(e) => setNewMintDecimals(e.target.value)}
                      className="mt-1 w-full max-w-[120px] rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-xs text-white"
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-[11px] text-muted">Total raw supply = 1B × 10^decimals; then mint authority is revoked.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-muted">Seed SOL</label>
                      <input
                        value={seedSol}
                        onChange={(e) => setSeedSol(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-xs text-white"
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-muted">Seed project tokens</label>
                      <input
                        value={seedTokens}
                        onChange={(e) => setSeedTokens(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-xs text-white"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={createPoolAndVaultAutomatic}
                    disabled={
                      poolVaultBusy ||
                      !wallet.connected ||
                      !connectedPk ||
                      !solanaPubkeysEqual(c.creatorWallet, connectedPk) ||
                      !vaultSelloutTarget
                    }
                    className="rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {poolVaultBusy ? "Confirm in wallet…" : "Create token, pool, vault (3–4 txs)"}
                  </button>
                </div>
              ) : null}
            </div>

            {alphaDone ? (
              <div className="space-y-1.5 text-[11px] text-emerald-200/95">
                <p>Step 1 done. Run step 2 for the Core collection when ready.</p>
                {c.alphaVault ? (
                  <p className="break-all font-mono text-[10px] text-white/70">Alpha Vault: {c.alphaVault}</p>
                ) : null}
              </div>
            ) : !vaultSelloutTarget ? (
              <p className="text-[11px] text-amber-200/90">
                Add a flat mint price on the launch record so we can compute the vault deposit cap.
              </p>
            ) : null}
          </div>
        </div>
        {!allDone && (
          <button
            type="button"
            onClick={runDeploy}
            disabled={busy || (!wallet.connected ? false : !canDeploy) || !alphaDone}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        )}
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-line/70 bg-panel/40 px-4 py-3">
            <StepDot status={s.status} index={i} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{s.label}</p>
              {s.signature ? (
                <a
                  href={explorerUrl("tx", s.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-block break-all font-mono text-[11px] text-accent hover:underline"
                >
                  {s.signature.slice(0, 16)}…{s.signature.slice(-12)}
                </a>
              ) : null}
              {s.message ? <p className="mt-0.5 text-xs text-rose-300">{s.message}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {topError ? <p className="mt-4 whitespace-pre-line text-sm text-rose-300">{topError}</p> : null}

      {!wallet.connected ? (
        <p className="mt-4 text-xs text-muted">
          Connect the wallet that published this launch.
          {c.creatorWallet ? (
            <span className="mt-1 block break-all font-mono text-[10px] text-white/70">{c.creatorWallet}</span>
          ) : (
            <span className="text-muted"> (No creator wallet on this launch record.)</span>
          )}
        </p>
      ) : !canDeploy && wallet.connected && connectedPk ? (
        <div className="mt-4 space-y-2 text-xs text-rose-300">
          <p>
            The signing wallet in your browser doesn’t match the <span className="text-white/90">creator_wallet</span>{" "}
            stored for this launch (short previews can look the same — compare the full strings).
          </p>
          <p className="break-all font-mono text-[10px] text-rose-200/95">
            Connected · {connectedPk.toBase58()}
          </p>
          <p className="break-all font-mono text-[10px] text-white/80">
            Required · {c.creatorWallet ?? "—"}
          </p>
          <p className="text-[11px] text-muted">
            Publish / deploy permissions follow the launch record. If the required line is a different account, sign in
            and publish with that wallet, or ask support to align the row (only when appropriate).
          </p>
        </div>
      ) : null}
    </section>
  );
}

function shorten(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function StepDot({ status, index }: { status: StepStatus; index: number }) {
  const base =
    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold";
  if (status === "done") {
    return <span className={`${base} bg-accent text-ink`}>✓</span>;
  }
  if (status === "running") {
    return <span className={`${base} bg-white/10 text-white`}>…</span>;
  }
  if (status === "error") {
    return <span className={`${base} bg-rose-500/20 text-rose-200`}>!</span>;
  }
  return <span className={`${base} border border-line text-muted`}>{index + 1}</span>;
}
