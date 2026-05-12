import Image from "next/image";
import Link from "next/link";

import { launchMintSetupComplete } from "@/lib/launch/launch-on-chain";
import type { Collection } from "@/types/collection";

/**
 * Compact "manage all my launches" list shown on the creator profile when
 * the viewer is the owner. Each row exposes direct edit / trade / page
 * links and surface-level state (published, on-chain).
 *
 * The richer per-launch analytics live on /dashboard — this list is the
 * fast-path for "I just want to fix a typo in one of my launches."
 */
export function OwnerLaunchManageList({ launches }: { launches: Collection[] }) {
  if (launches.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Your launches</h2>
        <div className="rounded-2xl border border-line bg-panel/40 p-6 text-sm text-muted">
          No launches yet.{" "}
          <Link href="/create" className="underline hover:text-white">
            Start one
          </Link>
          .
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-white">Your launches</h2>
        <p className="text-[11px] text-muted">
          Tap a row to open the full settings page.
        </p>
      </div>
      <div className="space-y-3">
        {launches.map((collection) => (
          <LaunchManageRow key={collection.slug} collection={collection} />
        ))}
      </div>
    </section>
  );
}

function LaunchManageRow({ collection: c }: { collection: Collection }) {
  const isOnChain = launchMintSetupComplete(c);
  // Never derive lifecycle from `dammPool` — infra metadata only (see `Collection.dammPool`).
  const labelStatus = !isOnChain
    ? "Draft · not deployed"
    : c.status === "live"
      ? "Live"
      : c.status;
  const tone = !isOnChain
    ? "border-amber-400/30 bg-amber-400/[0.05] text-amber-200"
    : "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200";

  return (
    <article className="rounded-2xl border border-line bg-panel/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-ink">
            {c.logoUrl ? (
              <Image src={c.logoUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="truncate font-medium text-white">{c.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${tone}`}
              >
                {labelStatus}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              {c.minted.toLocaleString()}/{c.supply.toLocaleString()} minted
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/project/${c.slug}/manage`}
            className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            Edit launch
          </Link>
          <Link
            href={`/launch/${c.slug}`}
            className="rounded-full border border-line bg-panel/30 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            Trade
          </Link>
          <Link
            href={`/project/${c.slug}`}
            className="rounded-full border border-line bg-panel/30 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            Project page
          </Link>
        </div>
      </div>
    </article>
  );
}
