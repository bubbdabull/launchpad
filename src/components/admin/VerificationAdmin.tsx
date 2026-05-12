"use client";

import { useState } from "react";

type Candidate = {
  wallet: string;
  displayName: string | null;
  twitterHandle: string | null;
  websiteUrl: string | null;
  verified: boolean;
  launchCount: number;
};

export function VerificationAdmin({ initial }: { initial: Candidate[] }) {
  const [rows, setRows] = useState<Candidate[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(wallet: string, verified: boolean) {
    setBusy(wallet);
    setError(null);
    try {
      const r = await fetch("/api/admin/verify-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, verified }),
      });
      const j = (await r.json()) as { ok: boolean; message?: string };
      if (!r.ok || !j.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
      setRows((rs) => rs.map((row) => (row.wallet === wallet ? { ...row, verified } : row)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-panel/40 p-6 text-sm text-muted">
        No creator profiles yet. Profiles are created lazily on first edit or first verification.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel/40 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Twitter</th>
              <th className="px-4 py-3 text-right">Launches</th>
              <th className="px-4 py-3 text-right">State</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.wallet} className="bg-ink/40">
                <td className="px-4 py-3">
                  <a
                    href={`/creator/${r.wallet}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white hover:text-accent"
                  >
                    {r.displayName ?? `${r.wallet.slice(0, 4)}…${r.wallet.slice(-4)}`}
                  </a>
                  <p className="font-mono text-[11px] text-muted">{r.wallet}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  {r.twitterHandle ? (
                    <a
                      href={`https://x.com/${r.twitterHandle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-white"
                    >
                      @{r.twitterHandle}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right text-white/90">{r.launchCount}</td>
                <td className="px-4 py-3 text-right">
                  {r.verified ? (
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                      Verified
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Unverified</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggle(r.wallet, !r.verified)}
                    disabled={busy === r.wallet}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      r.verified
                        ? "border border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                        : "bg-emerald-400 text-ink hover:brightness-110"
                    } disabled:opacity-50`}
                  >
                    {busy === r.wallet ? "…" : r.verified ? "Revoke" : "Verify"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
