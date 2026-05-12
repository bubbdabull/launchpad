import type { Collection, MintTier } from "@/types/collection";

function lamportsToSol(l: bigint): string {
  return (Number(l) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Tier-progress card shown on /launch/[slug] for tiered launches.
 * Displays each tier as a row with quota progress + price + status.
 */
export function MintTiersPanel({ collection: c }: { collection: Collection }) {
  if (!c.mintTiers || c.mintTiers.length === 0) return null;

  const tiers = c.mintTiers;
  const minted = c.minted;
  let runningStart = 0;

  return (
    <section className="rounded-2xl border border-line bg-panel/40 p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wider text-accent">Tiered mint</p>
        <p className="text-[11px] text-muted">{tiers.length} phases · ascending pricing</p>
      </div>
      <h2 className="mt-1 font-display text-xl font-semibold text-white">
        Phases fill in order — every tier is a vault deposit + mint
      </h2>

      <div className="mt-5 space-y-3">
        {tiers.map((t, i) => {
          const start = runningStart;
          const end = start + t.quota;
          runningStart = end;

          const soldInTier = Math.max(0, Math.min(t.quota, minted - start));
          const pct = t.quota > 0 ? Math.min(100, (soldInTier / t.quota) * 100) : 0;
          const isCurrent = minted >= start && minted < end;
          const isPast = minted >= end;
          const status = isPast ? "Sold out" : isCurrent ? "Live" : "Locked";

          return (
            <TierRow
              key={i}
              tier={t}
              index={i}
              soldInTier={soldInTier}
              pct={pct}
              status={status}
            />
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Each tier&apos;s mint price deposits into the same Meteora Alpha Vault. Total quote if all tiers sell ={" "}
        <span className="text-white/90">
          {lamportsToSol(
            tiers.reduce((s, t) => s + t.priceLamports * BigInt(t.quota), BigInt(0)),
          )}{" "}
          SOL
        </span>
        .
      </p>
    </section>
  );
}

function TierRow({
  tier,
  index,
  soldInTier,
  pct,
  status,
}: {
  tier: MintTier;
  index: number;
  soldInTier: number;
  pct: number;
  status: "Live" | "Sold out" | "Locked";
}) {
  const tone =
    status === "Live"
      ? "border-accent/40 bg-accent/[0.04]"
      : status === "Sold out"
        ? "border-emerald-400/30 bg-emerald-400/[0.03]"
        : "border-line bg-panel/30";
  const statusTone =
    status === "Live"
      ? "text-accent"
      : status === "Sold out"
        ? "text-emerald-300"
        : "text-muted";

  return (
    <div className={`rounded-xl border ${tone} p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted">Tier {index + 1}</span>
          <span className="text-sm font-semibold text-white">{tier.name}</span>
        </div>
        <div className="flex items-baseline gap-3 text-xs">
          <span className="text-white/90">{lamportsToSol(tier.priceLamports)} SOL</span>
          <span className={`uppercase tracking-wider ${statusTone}`}>{status}</span>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-[11px] text-muted">
        <span>
          <span className="text-white/90">{soldInTier.toLocaleString()}</span> /{" "}
          {tier.quota.toLocaleString()} minted
        </span>
        <span>
          {(Number(tier.priceLamports) / 1_000_000_000) * tier.quota} SOL tier raise
        </span>
      </div>
    </div>
  );
}
