"use client";

import type { CreationProtocolLayersSnapshot } from "@/lib/protocol/creation-protocol-layers";
import { CREATION_PROTOCOL_LAYERS } from "@/lib/protocol/creation-protocol-layers";
import { ProgramLayerGrid } from "@/components/protocol/ProgramLayerBlocks";

type Props = {
  /** When set (e.g. from manage), show “recorded at …”. Otherwise pre-create / generic copy. */
  snapshot?: CreationProtocolLayersSnapshot | null;
  /** Compact = single column; full = grid on wide screens */
  variant?: "full" | "compact";
  /**
   * When true (default), show copy about saving on draft submit. Set false on manage so we don’t imply an unsaved form.
   */
  preSubmitFooter?: boolean;
};

export function CreationProtocolLayersCard({ snapshot, variant = "full", preSubmitFooter = true }: Props) {
  const layers = snapshot?.layers?.length === 3 ? snapshot.layers : [...CREATION_PROTOCOL_LAYERS];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5 sm:p-6">
      <div className="mb-4 max-w-3xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Layers</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-white sm:text-xl">How responsibilities split</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Chain rules the money; this app helps you sign in and build transactions. A short snapshot is saved with your
          draft for support — not on-chain.
        </p>
        {snapshot?.capturedAt ? (
          <p className="mt-2 text-[11px] text-muted">
            Saved ·{" "}
            <time className="font-mono text-white/75" dateTime={snapshot.capturedAt}>
              {snapshot.capturedAt}
            </time>
          </p>
        ) : preSubmitFooter ? (
          <p className="mt-2 text-[11px] text-muted">Saved to your launch row when the draft is created.</p>
        ) : (
          <p className="mt-2 text-[11px] text-muted">No snapshot on file — showing defaults.</p>
        )}
      </div>
      <ProgramLayerGrid layers={layers} variant={variant} detail="titles" />
    </div>
  );
}
