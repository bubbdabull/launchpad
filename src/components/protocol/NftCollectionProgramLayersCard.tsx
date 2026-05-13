"use client";

import type { CreationProtocolLayersSnapshot } from "@/lib/protocol/creation-protocol-layers";
import { nftCollectionLayersForDisplay } from "@/lib/protocol/creation-protocol-layers";
import { ProgramLayerGrid } from "@/components/protocol/ProgramLayerBlocks";

type Props = {
  snapshot?: CreationProtocolLayersSnapshot | null;
  variant?: "full" | "compact";
  preSubmitFooter?: boolean;
};

export function NftCollectionProgramLayersCard({
  snapshot,
  variant = "full",
  preSubmitFooter = true,
}: Props) {
  const layers = nftCollectionLayersForDisplay(snapshot ?? undefined);
  const isV2 = snapshot?.schemaVersion === "creation-program/2" && snapshot.nftCollectionLayers?.length === 3;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5 sm:p-6">
      <div className="mb-4 max-w-3xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Genesis Pass &amp; NFT collection
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-white sm:text-xl">L1 · L2 · L3 (collection scope)</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The whole Genesis Pass pipeline — <span className="text-white/85">variation (trait) settings</span>,{" "}
          <span className="text-white/85">NFT art</span>, reveal timing, and holder-facing pages — is configured in this
          app on create and manage. Below is how that work maps onto the same layer model: on-chain truth, mirrored data,
          then this UI.
        </p>
        {snapshot?.capturedAt && isV2 ? (
          <p className="mt-2 text-[11px] text-muted">
            NFT program text was stored with this launch ·{" "}
            <time className="font-mono text-white/75" dateTime={snapshot.capturedAt}>
              {snapshot.capturedAt}
            </time>
          </p>
        ) : preSubmitFooter ? (
          <p className="mt-2 text-[11px] text-muted">
            When you create the draft, this block is saved in the same server JSON as the platform program (schema{" "}
            <span className="font-mono text-[10px] text-white/70">creation-program/2</span>) so support and audits see
            exactly what creators were told about collections and variations.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted">
            {isV2
              ? "Stored NFT-program copy from launch creation."
              : "Older snapshot without per-collection layers — showing current product text."}
          </p>
        )}
      </div>
      <ProgramLayerGrid layers={layers} variant={variant} />
    </div>
  );
}
