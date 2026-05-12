"use client";

import { useEffect, useState } from "react";

type Row = {
  wallet: string;
  referralCount: number;
  distinctLaunches: number;
  mintVolumeLamports: string;
  paidOutLamports: string;
};

type Resp =
  | { ok: true; window: string; totalReferrers: number; totalReferrals: number; leaderboard: Row[] }
  | { ok: false; message: string };

const WINDOWS = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All time" },
] as const;

function lamportsToSol(s: string): string {
  try {
    const n = Number(BigInt(s)) / 1_000_000_000;
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

function shortAddress(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function ReferralLeaderboard() {
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]["key"]>("30d");
  const [resp, setResp] = useState<Extract<Resp, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/referrals/leaderboard?window=${windowKey}&limit=25`, {
          cache: "no-store",
        });
        const j = (await r.json()) as Resp;
        if (!j.ok) throw new Error(j.message);
        if (!cancelled) {
          setResp(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load leaderboard.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [windowKey]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-white">Top referrers</h2>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWindowKey(w.key)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                windowKey === w.key
                  ? "bg-white text-ink"
                  : "border border-line bg-panel text-muted hover:text-white"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {resp && resp.leaderboard.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel/40 p-6 text-sm text-muted">
          No referrals in this window yet.
        </div>
      ) : null}

      {resp && resp.leaderboard.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel/40 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3 text-right">Referrals</th>
                <th className="px-4 py-3 text-right">Launches</th>
                <th className="px-4 py-3 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {resp.leaderboard.map((r, i) => (
                <tr key={r.wallet} className="bg-ink/40">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <a href={`/creator/${r.wallet}`} className="font-mono text-xs text-white/90 hover:text-accent">
                      {shortAddress(r.wallet)}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right text-white/90">{r.referralCount}</td>
                  <td className="px-4 py-3 text-right text-white/70">{r.distinctLaunches}</td>
                  <td className="px-4 py-3 text-right text-emerald-300">
                    {lamportsToSol(r.mintVolumeLamports)} SOL
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
