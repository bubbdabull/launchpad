import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountPanel } from "@/components/account/AccountPanel";
import { getWalletSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getWalletSession();
  if (!session) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">
          Your account
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Wallet & profile
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Your Solana identity for Creator Launchpad. Top up SOL with a card,
          export your embedded wallet, or jump straight into your launches and
          referrals.
        </p>
      </div>

      <AccountPanel signedInAddress={session.address} />

      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/"
          className="rounded-2xl border border-line bg-panel/40 p-4 transition hover:border-white/25"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Trade
          </p>
          <p className="mt-2 text-white">Browse launches</p>
          <p className="mt-1 text-xs text-muted">
            Mint Genesis Passes and trade tokens with your wallet.
          </p>
        </Link>
        <Link
          href="/dashboard"
          className="rounded-2xl border border-line bg-panel/40 p-4 transition hover:border-white/25"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Dashboard
          </p>
          <p className="mt-2 text-white">Your launches & fees</p>
          <p className="mt-1 text-xs text-muted">
            Mints, volume, holders, fees claimed.
          </p>
        </Link>
        <Link
          href="/referrals"
          className="rounded-2xl border border-line bg-panel/40 p-4 transition hover:border-white/25"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Referrals
          </p>
          <p className="mt-2 text-white">Your share link</p>
          <p className="mt-1 text-xs text-muted">
            Earn a cut every time someone you sent mints a Pass.
          </p>
        </Link>
        <Link
          href="/create"
          className="rounded-2xl border border-line bg-panel/40 p-4 transition hover:border-white/25"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Launch
          </p>
          <p className="mt-2 text-white">Start a new project</p>
          <p className="mt-1 text-xs text-muted">
            Token + Genesis Pass via Meteora Alpha Vault.
          </p>
        </Link>
      </div>
    </div>
  );
}
