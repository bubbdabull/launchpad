import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GenesisCollectionPreviewStrip } from "@/components/genesis/GenesisCollectionPreviewStrip";
import { GenesisGenerativeBanner } from "@/components/genesis/GenesisGenerativeBanner";
import { MintEnergyShell } from "@/components/mint/MintEnergyShell";
import { GenesisPassMintPanel } from "@/components/mint/GenesisPassMintPanel";
import { getCollectionBySlug } from "@/lib/data/launchpad";
import { fetchAnchorMintActive } from "@/lib/launch/anchor-lifecycle-server";
import { pct } from "@/lib/format";

type PageProps = { params: Promise<{ slug: string }> };

export default async function MintPage({ params }: PageProps) {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  const anchorMintActive = await fetchAnchorMintActive(c);

  return (
    <div>
      <div className="relative h-[320px] w-full sm:h-[380px]">
        <Image src={c.bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(34,245,158,0.1),transparent_50%)]" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-xl sm:h-28 sm:w-28">
                <Image src={c.logoUrl} alt="" fill className="object-cover" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-accent">
                  Mint · {`$${(c.tokenSymbol ?? "TOKEN").toUpperCase()}`}
                </p>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {c.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/75">{c.tagline}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                  Fixed price · limited supply · on-chain rules
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 self-start sm:flex-row sm:items-center sm:self-end">
              <Link
                href={`/project/${c.slug}/trade`}
                className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur hover:border-white/30"
              >
                {`Trade · $${(c.tokenSymbol ?? "TOKEN").toUpperCase()}`}
              </Link>
              <Link
                href={`/project/${c.slug}`}
                className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur hover:border-white/30"
              >
                Project
              </Link>
              <Link
                href="/#launches"
                className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur hover:border-white/30"
              >
                All launches
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <MintEnergyShell slug={c.slug}>
          {c.genesisPassNft ? (
            <div className="mb-8">
              <GenesisGenerativeBanner slug={c.slug} config={c.genesisPassNft} />
            </div>
          ) : null}
          <div className="grid gap-10 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
          <p className="text-sm leading-relaxed text-muted">{c.description}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Cap", c.supply.toLocaleString()],
              ["Filled", `${c.minted.toLocaleString()} (${pct(c.minted, c.supply)}%)`],
              ["Ticket", c.priceLabel],
              ["Mode", c.phase],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-line bg-panel/60 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
                <p className="mt-2 text-sm font-medium text-white">{v}</p>
              </div>
            ))}
          </div>
          {c.utilities.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Pass utilities</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.utilities.map((u) => (
                  <span
                    key={u}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs text-white ring-1 ring-white/10"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {c.genesisPassNft && c.coreCollection ? (
            <GenesisCollectionPreviewStrip collectionMint={c.coreCollection} />
          ) : null}
            </div>
            <GenesisPassMintPanel collection={c} anchorMintActive={anchorMintActive} />
          </div>
        </MintEnergyShell>
      </div>
    </div>
  );
}
