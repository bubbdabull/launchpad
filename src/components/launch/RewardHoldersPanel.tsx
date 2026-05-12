"use client";

import { useWallet } from "@solana/wallet-adapter-react";

import { solanaPubkeysEqual } from "@/lib/solana/pubkey-eq";
import type { Collection } from "@/types/collection";

type Props = { collection: Collection };

/**
 * Server-side token holder batching was removed. SPL rewards must flow through
 * on-chain claim / stream programs; the backend never plans allocations.
 */
export function RewardHoldersPanel({ collection: c }: Props) {
  const wallet = useWallet();
  const isCreator = !!wallet.publicKey && solanaPubkeysEqual(c.creatorWallet, wallet.publicKey);

  if (!isCreator) return null;

  return (
    <section className="rounded-2xl border border-line bg-panel/40 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Token rewards</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-white">On-chain claims only</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Per-holder token splits are no longer previewed or executed from this app. Wire the Anchor claim program and
        sign <code className="rounded bg-black/30 px-1 font-mono text-[11px]">claim</code> / stream instructions from
        the client. The API route{" "}
        <code className="rounded bg-black/30 px-1 font-mono text-[11px]">/api/launches/…/reward-holders</code> is
        disabled (410) so the server cannot assign token amounts.
      </p>
    </section>
  );
}
