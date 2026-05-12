import { redirect } from "next/navigation";

import { VerificationAdmin } from "@/components/admin/VerificationAdmin";
import { getWalletSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function adminWallets(): Set<string> {
  const raw = (process.env.PLATFORM_ADMIN_WALLETS ?? "").trim();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => BASE58_RE.test(s)),
  );
}

export const dynamic = "force-dynamic";

type Candidate = {
  wallet: string;
  displayName: string | null;
  twitterHandle: string | null;
  websiteUrl: string | null;
  verified: boolean;
  launchCount: number;
};

export default async function AdminVerificationsPage() {
  const session = await getWalletSession();
  if (!session) redirect("/");
  if (!adminWallets().has(session.address)) redirect("/");

  const supabase = createServiceRoleClient();

  // Pull every distinct creator wallet from collections that doesn't yet
  // have a verified profile. Limit to 200 to keep the page responsive.
  const { data: profiles } = await supabase
    .from("creator_profiles")
    .select("wallet, display_name, twitter_handle, website_url, verified, launch_count")
    .order("verified", { ascending: true })
    .order("launch_count", { ascending: false })
    .limit(200);

  const candidates: Candidate[] = (profiles ?? []).map((p) => {
    const r = p as {
      wallet: string;
      display_name: string | null;
      twitter_handle: string | null;
      website_url: string | null;
      verified: boolean;
      launch_count: number;
    };
    return {
      wallet: r.wallet,
      displayName: r.display_name,
      twitterHandle: r.twitter_handle,
      websiteUrl: r.website_url,
      verified: r.verified,
      launchCount: r.launch_count,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          Creator verifications
        </h1>
        <p className="mt-2 text-sm text-muted">
          Toggle the verified badge for each creator after manual review. Visible only to admin
          wallets configured in <span className="font-mono">PLATFORM_ADMIN_WALLETS</span>.
        </p>
      </div>
      <VerificationAdmin initial={candidates} />
    </div>
  );
}
