/**
 * @apiRouteLayer L2
 */

import { enforceL2RouteModuleBoundary } from "@/lib/architecture/l2-invariants";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getWalletSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TX_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;

type DeployBody = Partial<{
  alphaVault: string;
  coreCollection: string;
  collectionSignature: string;
  /** Optional SPL mint for listings / metadata when known (e.g. from Meteora). */
  tokenMint: string;
  /** Meteora DAMM v2 pool linked to this launch (e.g. after auto pool create). */
  dammPool: string;
}>;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/** Creator-only read of mirrored on-chain wiring (Supabase). Used to refresh the deploy panel after writes. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await getWalletSession();
  if (!session) return bad("Sign in with your wallet first.", 401);

  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{3,64}$/.test(slug)) return bad("Bad slug.");

  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("collections")
    .select("creator_wallet, core_collection, alpha_vault, token_mint")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !row) return bad("Launch not found.", 404);
  if (row.creator_wallet !== session.address) {
    return bad("Only the launch creator can read deploy wiring.", 403);
  }

  return NextResponse.json({
    ok: true,
    coreCollection: row.core_collection ?? null,
    alphaVault: row.alpha_vault ?? null,
    tokenMint: row.token_mint ?? null,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await getWalletSession();
  if (!session) return bad("Sign in with your wallet first.", 401);

  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{3,64}$/.test(slug)) return bad("Bad slug.");

  let body: DeployBody;
  try {
    body = (await req.json()) as DeployBody;
  } catch {
    return bad("Invalid JSON body.");
  }

  const addressFields: Array<[keyof DeployBody, string]> = [
    ["alphaVault", "alphaVault"],
    ["coreCollection", "coreCollection"],
    ["tokenMint", "tokenMint"],
    ["dammPool", "dammPool"],
  ];
  for (const [key, label] of addressFields) {
    const v = body[key];
    if (v != null && !SOLANA_ADDRESS_RE.test(v)) return bad(`Invalid ${label} address.`);
  }
  if (body.collectionSignature && !TX_SIG_RE.test(body.collectionSignature)) {
    return bad("Invalid collectionSignature.");
  }

  const supabase = createServiceRoleClient();

  const { data: existing, error: readErr } = await supabase
    .from("collections")
    .select("creator_wallet, alpha_vault, token_mint, core_collection, status")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr || !existing) return bad("Launch not found.", 404);
  if (existing.creator_wallet !== session.address) {
    return bad("Only the launch creator can deploy on-chain.", 403);
  }

  const update: Record<string, string> = {};
  if (body.alphaVault) update.alpha_vault = body.alphaVault;
  if (body.coreCollection) update.core_collection = body.coreCollection;
  if (body.tokenMint) update.token_mint = body.tokenMint;
  // Persists cached pool pubkey for UX/explorers — does not assert LaunchState.
  if (body.dammPool) update.damm_pool = body.dammPool;
  if (body.collectionSignature) update.deploy_collection_signature = body.collectionSignature;

  if (Object.keys(update).length === 0) return bad("Nothing to update.");

  const row = existing as {
    alpha_vault: string | null;
    token_mint: string | null;
    core_collection: string | null;
    status: string;
  };
  const willHaveAlpha = body.alphaVault ?? row.alpha_vault;
  const willHaveCollection = body.coreCollection ?? row.core_collection;

  // Do not flip `collections.status` here — launch lifecycle is enforced on-chain.
  // UX may derive "mint open" from mirrored addresses (alpha_vault + core_collection)
  // until an RPC-backed lifecycle reader is added.

  const { error: writeErr } = await supabase
    .from("collections")
    .update(update)
    .eq("slug", slug);
  if (writeErr) return bad(writeErr.message, 500);

  revalidatePath(`/launch/${slug}`);
  revalidatePath(`/mint/${slug}`);
  revalidatePath(`/project/${slug}`);
  revalidatePath(`/project/${slug}/manage`);
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    /** @deprecated Lifecycle is on-chain; use mirrored addresses for UX readiness. */
    addressesUpdated: Object.keys(update).length > 0,
  });
}

enforceL2RouteModuleBoundary("src/app/api/launches/[slug]/deploy/route.ts", "L2:GET|POST /api/launches/[slug]/deploy");
