import Link from "next/link";

import { CreatorDashboard } from "@/components/dashboard/CreatorDashboard";
import { CreatorHubNav } from "@/components/dashboard/CreatorHubNav";
import { getWalletSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getWalletSession();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Your launches
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Overview of mints, volume, and fees for wallets you use as a creator.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Shortcuts</p>
            <h2 className="mt-1 font-display text-base font-semibold text-white">Navigate</h2>
          </div>
        </div>
        <CreatorHubNav />
      </section>

      {session ? (
        <CreatorDashboard />
      ) : (
        <div className="rounded-2xl border border-line bg-panel/40 p-8 text-sm text-muted">
          Connect your wallet to load this dashboard.{" "}
          <Link href="/" className="font-medium text-accent underline hover:text-white">
            Back to home
          </Link>
        </div>
      )}
    </div>
  );
}
