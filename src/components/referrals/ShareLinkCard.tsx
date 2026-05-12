"use client";

import { useState } from "react";

type Props = { wallet: string; origin: string };

export function ShareLinkCard({ wallet, origin }: Props) {
  const link = `${origin}/?ref=${wallet}`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-400/[0.05] to-transparent p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-300">Your referral link</p>
        <p className="text-[11px] text-muted">90-day attribution · first-touch wins</p>
      </div>
      <h2 className="mt-1 font-display text-xl font-semibold text-white">
        Share this and earn from every mint
      </h2>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="block flex-1 truncate rounded-lg border border-line bg-ink px-3 py-2 text-xs text-white/90">
          {link}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(link).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
          className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        You can also append <span className="font-mono">?ref={wallet.slice(0, 6)}…</span> to any
        launch URL — it works the same. Self-referrals are filtered automatically.
      </p>
    </div>
  );
}
