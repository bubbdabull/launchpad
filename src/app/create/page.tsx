import Link from "next/link";

import { CreateLaunchForm } from "@/components/launchpad/CreateLaunchForm";
import { getWalletSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

type DraftRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  is_published: boolean;
  created_at: string;
};

export default async function CreatePage() {
  const session = await getWalletSession();
  const drafts: DraftRow[] = [];

  if (session) {
    try {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("collections")
        .select("id,slug,name,status,is_published,created_at")
        .eq("creator_wallet", session.address)
        .order("created_at", { ascending: false })
        .limit(8);
      if (data) drafts.push(...(data as DraftRow[]));
    } catch {
      // keep page usable even if service role key isn’t set yet
    }
  }

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,245,158,0.1),transparent_65%),radial-gradient(ellipse_at_20%_20%,rgba(255,77,157,0.08),transparent_55%)]" />

      <header className="relative max-w-3xl">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Create</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Launch a collection
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Pair a Genesis Pass with a token raise and on-chain deploy steps. Connect your wallet to publish and upload
          assets.
        </p>
      </header>

      {!session ? (
        <div className="relative mt-10 rounded-2xl border border-line bg-panel/80 p-8 shadow-card">
          <p className="text-sm text-muted">
            Connect your wallet in the header, then use <span className="font-medium text-white">Sign in</span> to
            create and manage launches.
          </p>
        </div>
      ) : (
        <div className="relative mt-12 space-y-10">
          <div className="rounded-2xl border border-line bg-panel/60 p-6 sm:p-7">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Connected wallet</p>
            <p className="mt-2 break-all font-mono text-sm text-white">{session.address}</p>
          </div>

          <CreateLaunchForm />

          <div className="rounded-2xl border border-white/[0.06] bg-[#121214]/80 p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-white">Your drafts</h2>
            <div className="mt-5 space-y-3">
              {drafts.length === 0 && (
                <p className="text-sm text-muted">Nothing deployed yet — first publish shows up here.</p>
              )}
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col gap-3 rounded-xl border border-line/80 bg-ink/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{d.name}</p>
                    <p className="text-xs text-muted">{d.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <p className={d.is_published ? "text-emerald-300" : "text-amber-300"}>
                      {d.is_published ? "Published" : "Unpublished"}
                    </p>
                    <span className="text-muted">· {d.status}</span>
                    <span className="hidden text-muted sm:inline">·</span>
                    <Link href={`/project/${d.slug}`} className="font-medium text-accent hover:underline">
                      Project
                    </Link>
                    <Link href={`/mint/${d.slug}`} className="font-medium text-accent hover:underline">
                      Mint
                    </Link>
                    <Link href={`/launch/${d.slug}`} className="font-medium text-accent hover:underline">
                      Curve
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Link
        href="/"
        className="relative mt-14 inline-flex rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-accent/40 hover:text-white"
      >
        ← Back to home
      </Link>
    </div>
  );
}
