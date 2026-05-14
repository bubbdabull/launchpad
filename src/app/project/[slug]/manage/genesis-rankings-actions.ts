"use server";

import { revalidatePath } from "next/cache";

import { getWalletSession } from "@/lib/auth/session";
import { isCollectionCreator } from "@/lib/data/store-admin";
import { reindexGenesisPassRankingsForSlug } from "@/lib/genesis-rankings/reindex-collection";

export type GenesisRankingsReindexState = { ok: boolean; message?: string };
export const genesisRankingsReindexInitialState: GenesisRankingsReindexState = { ok: false };

export async function reindexGenesisLeaderboard(
  _prev: GenesisRankingsReindexState,
  form: FormData,
): Promise<GenesisRankingsReindexState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in with your wallet first." };

  const slug = String(form.get("slug") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9-]{3,64}$/.test(slug)) return { ok: false, message: "Bad slug." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "Only the launch creator can refresh the leaderboard." };

  const result = await reindexGenesisPassRankingsForSlug(slug);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/launch/${slug}`);
  revalidatePath(`/mint/${slug}`);
  revalidatePath(`/project/${slug}/manage`);
  return {
    ok: true,
    message: `Indexed ${result.indexed} mints (${result.pages} Helius page(s)). Leaderboard is live on the launch page.`,
  };
}
