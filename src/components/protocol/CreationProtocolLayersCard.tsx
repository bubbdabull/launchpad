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
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Creation program</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-white sm:text-xl">L1 · L2 · L3 layers</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          How this launchpad splits responsibility: chain truth, mirrored data, and the UI you are using now. A signed
          copy of this structure is stored on the server with your launch when the draft is created (not on-chain — L1
          programs already hold monetary rules on Solana).
        </p>
        {snapshot?.capturedAt ? (
          <p className="mt-2 text-[11px] text-muted">
            Recorded with this launch ·{" "}
            <time className="font-mono text-white/75" dateTime={snapshot.capturedAt}>
              {snapshot.capturedAt}
            </time>{" "}
            · <span className="font-mono text-[10px] text-white/60">{snapshot.schemaVersion}</span>
          </p>
        ) : preSubmitFooter ? (
          <p className="mt-2 text-[11px] text-muted">
            After you submit this form, the same program text is written to your collection row as JSON for audit and
            support.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted">
            No layer snapshot on file for this launch — showing the current product program for reference (older drafts
            or pre-migration rows).
          </p>
        )}
      </div>
      <ProgramLayerGrid layers={layers} variant={variant} />
    </div>
  );
}
