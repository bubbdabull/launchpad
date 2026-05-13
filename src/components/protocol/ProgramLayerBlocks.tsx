import type { CreationProtocolLayer } from "@/lib/protocol/creation-protocol-layers";

const ACCENT: Record<CreationProtocolLayer["id"], string> = {
  L1: "border-emerald-400/35 bg-emerald-400/[0.06]",
  L2: "border-sky-400/35 bg-sky-400/[0.06]",
  L3: "border-amber-400/35 bg-amber-400/[0.06]",
};

export function ProgramLayerBlock({ layer }: { layer: CreationProtocolLayer }) {
  return (
    <div className={`rounded-xl border p-4 ${ACCENT[layer.id]}`}>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">{layer.id}</p>
      <h3 className="mt-1 font-display text-sm font-semibold text-white sm:text-base">{layer.title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{layer.subtitle}</p>
      <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-white/85">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/90">Does</p>
        <ul className="list-inside list-disc space-y-1 text-muted marker:text-white/35">
          {layer.responsibilities.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted/90">Does not</p>
        <ul className="list-inside list-disc space-y-1 text-muted marker:text-white/35">
          {layer.boundaries.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProgramLayerGrid({
  layers,
  variant = "full",
}: {
  layers: CreationProtocolLayer[];
  variant?: "full" | "compact";
}) {
  const gridClass = variant === "full" ? "grid gap-4 lg:grid-cols-3" : "grid gap-4";
  return (
    <div className={gridClass}>
      {layers.map((layer) => (
        <ProgramLayerBlock key={layer.id} layer={layer} />
      ))}
    </div>
  );
}
