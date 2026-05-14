import Link from "next/link";

import { createPublicSupabaseClient } from "@/lib/supabase/public-read";

type Row = {
  rank: number;
  asset_mint: string;
  combo_id: string;
  summary_tier: string;
  rarity_score: number;
  picks: unknown;
};

function traitPreview(picks: unknown): string {
  if (!Array.isArray(picks)) return "—";
  const names: string[] = [];
  for (const p of picks) {
    if (p && typeof p === "object" && "traitName" in p) {
      const n = String((p as { traitName?: string }).traitName ?? "").trim();
      if (n) names.push(n);
    }
    if (names.length >= 4) break;
  }
  return names.length ? names.join(" · ") : "—";
}

type Props = {
  slug: string;
  hasGenerativeTraits: boolean;
  isCreator?: boolean;
};

/** Server-rendered top of the generative leaderboard (Supabase; RLS for published launches). */
export async function GenesisLeaderboardSection({ slug, hasGenerativeTraits, isCreator }: Props) {
  if (!hasGenerativeTraits) return null;

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("genesis_pass_rankings")
    .select("rank, asset_mint, combo_id, summary_tier, rarity_score, picks")
    .eq("collection_slug", slug)
    .order("rank", { ascending: true })
    .limit(25);

  if (error) return null;

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Genesis rarity leaderboard</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-white">No rankings indexed yet</h2>
        <p className="mt-2 text-sm text-muted">
          {isCreator
            ? "Use Manage → “Refresh rarity leaderboard” to pull mints from the chain and build scores."
            : "The creator can publish a ranked list from the project dashboard after mints exist."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Genesis rarity leaderboard</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Top rolls (stored)</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            Rank 1 = highest score under a naive weight model (same trait rules as metadata). For fun / transparency —
            not used for rewards.
          </p>
        </div>
        <Link
          href={`/api/launch/${encodeURIComponent(slug)}/genesis-leaderboard?limit=100`}
          className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          JSON feed ↗
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Tier</th>
              <th className="py-2 pr-3 font-medium">Traits</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 font-medium">Mint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asset_mint} className="border-b border-white/[0.06] text-white/90">
                <td className="py-2.5 pr-3 font-mono text-accent">{r.rank}</td>
                <td className="py-2.5 pr-3">{r.summary_tier}</td>
                <td className="max-w-[240px] truncate py-2.5 pr-3 text-muted" title={traitPreview(r.picks)}>
                  {traitPreview(r.picks)}
                </td>
                <td className="py-2.5 pr-3 font-mono text-[11px] text-white/80">{Number(r.rarity_score).toLocaleString()}</td>
                <td className="py-2.5 font-mono text-[10px] text-muted">
                  {r.asset_mint.slice(0, 4)}…{r.asset_mint.slice(-4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
