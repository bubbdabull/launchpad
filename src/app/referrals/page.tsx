import { headers } from "next/headers";

import { ReferralLeaderboard } from "@/components/referrals/ReferralLeaderboard";
import { MyReferrals } from "@/components/referrals/MyReferrals";
import { ShareLinkCard } from "@/components/referrals/ShareLinkCard";
import { getWalletSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const session = await getWalletSession();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">Referrals</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Bring users in. Get paid when they mint.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Share your wallet-tagged link to any launch. Anyone who clicks through and mints a Genesis
          Pass within 90 days is permanently linked to you. The platform&rsquo;s genesis mint tax (7% of mint
          price, same as the launch-controller program) may be split with referrers — your stats here track the
          volume you&rsquo;ve driven.
        </p>
      </div>

      {session ? (
        <ShareLinkCard wallet={session.address} origin={origin} />
      ) : (
        <div className="rounded-2xl border border-line bg-panel/40 p-6">
          <p className="text-sm text-muted">
            Connect your wallet to generate your personal referral link. Anyone who mints from a
            launch through your link gets attributed to you for 90 days.
          </p>
        </div>
      )}

      {session ? <MyReferrals wallet={session.address} /> : null}

      <ReferralLeaderboard />

      <div className="rounded-2xl border border-line bg-panel/40 p-6 text-sm leading-relaxed text-muted">
        <p className="text-[10px] uppercase tracking-wider text-muted">How payouts work</p>
        <p className="mt-2">
          Referrals are recorded the moment a Pass mint confirms on Solana. The platform collects a
          genesis mint tax (7% of mint price); a portion may be reserved for referrers and accrue to your
          balance here. Payouts batch weekly to keep tx costs low. The schema (
          <span className="font-mono text-white/80">paid_out_lamports</span>) is what the payout
          worker fills in.
        </p>
      </div>
    </div>
  );
}
