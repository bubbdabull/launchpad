"use client";

import { useEffect, useState } from "react";

type Referral = {
  referredWallet: string;
  collectionSlug: string;
  mintSignature: string | null;
  mintPriceLamports: string;
  paidOutLamports: string;
  paidOutSignature: string | null;
  createdAt: string;
};

type ApiResp =
  | {
      ok: true;
      wallet: string;
      totalCount: number;
      distinctReferred: number;
      distinctLaunches: number;
      totalVolumeLamports: string;
      totalPaidLamports: string;
      referrals: Referral[];
    }
  | { ok: false; message: string };

function lamportsToSol(s: string): string {
  let v: bigint;
  try {
    v = BigInt(s);
  } catch {
    return "—";
  }
  const n = Number(v) / 1_000_000_000;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 0.01 ? 6 : 4,
  });
}

function shortAddress(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function MyReferrals({ wallet: _wallet }: { wallet: string }) {
  void _wallet;
  const [data, setData] = useState<Extract<ApiResp, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/referrals/me", { cache: "no-store" });
        const j = (await r.json()) as ApiResp;
        if (!j.ok) throw new Error(j.message);
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load referrals.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-white">Your referrals</h2>
        <p className="text-[11px] text-muted">last 500 entries</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total mints" value={data?.totalCount.toLocaleString() ?? "—"} />
        <Stat label="Distinct buyers" value={data?.distinctReferred.toLocaleString() ?? "—"} />
        <Stat
          label="Mint volume"
          value={data ? `${lamportsToSol(data.totalVolumeLamports)} SOL` : "—"}
        />
        <Stat
          label="Earned"
          value={data ? `${lamportsToSol(data.totalPaidLamports)} SOL` : "—"}
          highlight
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {data && data.referrals.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel/40 p-6 text-sm text-muted">
          No referred mints yet. Share your link above to start earning.
        </div>
      ) : null}

      {data && data.referrals.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel/40 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Launch</th>
                <th className="px-4 py-3 text-right">Mint paid</th>
                <th className="px-4 py-3 text-right">Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.referrals.map((r, i) => (
                <tr key={`${r.referredWallet}-${r.collectionSlug}-${i}`} className="bg-ink/40">
                  <td className="px-4 py-3 text-muted">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/90">
                    {shortAddress(r.referredWallet)}
                  </td>
                  <td className="px-4 py-3 text-white/90">{r.collectionSlug}</td>
                  <td className="px-4 py-3 text-right text-white/90">
                    {lamportsToSol(r.mintPriceLamports)} SOL
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-300">
                    {lamportsToSol(r.paidOutLamports)} SOL
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-emerald-400/30 bg-emerald-400/[0.04]"
          : "border-line bg-panel/40"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-semibold ${
          highlight ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
