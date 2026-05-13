import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProtocolLayersHint } from "@/components/protocol/ProtocolLayersHint";
import { DualMarketDiscoveryCard } from "@/components/launch/DualMarketDiscoveryCard";
import { GenesisPassNftConfigForm } from "@/components/launch/GenesisPassNftConfigForm";
import { LaunchSettingsForm } from "@/components/launch/LaunchSettingsForm";
import { getWalletSession } from "@/lib/auth/session";
import { getCollectionBySlug } from "@/lib/data/launchpad";
import { isCollectionCreator } from "@/lib/data/store-admin";
import { launchMintSetupComplete } from "@/lib/launch/launch-on-chain";
import { createServiceRoleClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function LaunchManagePage({ params }: PageProps) {
  const { slug } = await params;

  const session = await getWalletSession();
  if (!session) redirect(`/launch/${slug}`);

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) redirect(`/launch/${slug}`);

  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  const supabase = createServiceRoleClient();
  let isPublished = true;
  try {
    const { data: pub } = await supabase
      .from("collections")
      .select("is_published")
      .eq("slug", slug)
      .maybeSingle();
    if (pub) isPublished = !!(pub as { is_published: boolean }).is_published;
  } catch {
    /* fall through */
  }

  const isOnChain = launchMintSetupComplete(c);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">
          Manage launch
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {c.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Deploy on-chain, tune the Genesis Pass, and control visibility. The public project page is
          defined when you create the launch (headline, story, art, and links).
        </p>
        <ProtocolLayersHint className="mt-4 max-w-2xl" />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ManageLink
          href={`/launch/${slug}`}
          label="Trade & deploy"
          hint="Alpha Vault, on-chain wiring, economics"
          highlight
        />
        <ManageLink
          href={`/mint/${slug}`}
          label="Genesis Pass mint"
          hint="Public mint surface"
          highlight
        />
        <ManageLink href={`/project/${slug}`} label="View project page" hint="Art, mint progress, links" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ManageLink
          href={`/project/${slug}`}
          label="View project page"
          hint="Public landing"
        />
        <ManageLink
          href={`/launch/${slug}`}
          label="View trade page"
          hint="Mint + deploy controls"
        />
        <ManageLink href={`/create`} label="Start another launch" hint="New collection + vault" />
      </section>

      <div className="rounded-2xl border border-line bg-panel/40 p-5 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">On-chain status</p>
            <p className="mt-1 font-display text-base text-white">
              {isOnChain ? "Live on-chain" : "Not deployed yet"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {isOnChain
                ? "Genesis Pass collection and Alpha Vault are linked — token symbol, supply, mint price, and vesting params are treated as committed for this launch."
                : "All fields are still editable. Once you finish deploy on the Trade page, the on-chain wiring locks in."}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Visibility</p>
            <p className="mt-1 font-display text-base text-white">
              {isPublished ? "Published" : "Hidden"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {isPublished
                ? "Visible on the home grid + discovery feeds."
                : "Hidden from listings — direct links still work."}
            </p>
          </div>
        </div>
      </div>

      {isOnChain && c.tokenMint ? <DualMarketDiscoveryCard collection={c} variant="full" /> : null}

      <LaunchSettingsForm collection={c} isOnChain={isOnChain} isPublished={isPublished} />

      <GenesisPassNftConfigForm collection={c} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/40 p-5">
        <div>
          <p className="text-sm font-medium text-white">Need to change deploy-locked fields?</p>
          <p className="mt-1 text-[11px] text-muted">
            Token symbol / supply / mint price / vesting are immutable once on-chain. To change them you&rsquo;d need to deploy a new launch.
          </p>
        </div>
        <Link
          href="/create"
          className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-white/30"
        >
          Start a new launch
        </Link>
      </div>
    </div>
  );
}

function ManageLink({
  href,
  label,
  hint,
  highlight,
}: {
  href: string;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-4 transition ${
        highlight
          ? "border-accent/30 bg-accent/[0.04] hover:bg-accent/[0.08]"
          : "border-line bg-panel/40 hover:border-white/15"
      }`}
    >
      <p
        className={`font-medium ${
          highlight ? "text-accent" : "text-white"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </Link>
  );
}
