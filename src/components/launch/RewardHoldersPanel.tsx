"use client";

import { useWallet } from "@solana/wallet-adapter-react";

import { solanaPubkeysEqual } from "@/lib/solana/pubkey-eq";
import type { Collection } from "@/types/collection";

type Props = { collection: Collection };

/**
 * Server-side token holder batching was removed. Rewards to holders go through
 * Solana the way your launch is set up—not from a batch button here.
 */
export function RewardHoldersPanel({ collection: c }: Props) {
  const wallet = useWallet();
  const isCreator = !!wallet.publicKey && solanaPubkeysEqual(c.creatorWallet, wallet.publicKey);

  if (!isCreator) return null;

  return (
    <section className="rounded-2xl border border-line bg-panel/40 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Token rewards</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-white">Paying holders</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Sending tokens to holders happens on Solana after you set that up. This page won&apos;t run those payments for
        you.
      </p>
    </section>
  );
}
