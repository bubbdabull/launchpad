"use client";

import { useActionState } from "react";

import {
  genesisRankingsReindexInitialState,
  reindexGenesisLeaderboard,
  type GenesisRankingsReindexState,
} from "@/app/project/[slug]/manage/genesis-rankings-actions";

type Props = { slug: string; enabled: boolean };

export function ReindexGenesisLeaderboardForm({ slug, enabled }: Props) {
  const [state, action, pending] = useActionState<GenesisRankingsReindexState, FormData>(
    reindexGenesisLeaderboard,
    genesisRankingsReindexInitialState,
  );

  if (!enabled) return null;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">On-chain leaderboard</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Scores each minted Genesis Pass from your trait weights (naive model), ranks them, and stores results for the
        launch page. Uses Helius to list Core assets — run again after new mints.
      </p>
      {state.message ? (
        <p
          className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
            state.ok ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200" : "border-rose-400/30 bg-rose-400/5 text-rose-200"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <form action={action} className="mt-3">
        <input type="hidden" name="slug" value={slug} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-accent/50 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
        >
          {pending ? "Indexing…" : "Refresh rarity leaderboard"}
        </button>
      </form>
    </div>
  );
}
