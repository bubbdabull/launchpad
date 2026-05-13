"use client";

import { useActionState, useMemo, useState } from "react";

import {
  genesisPassManageInitialState,
  updateGenesisPassNftConfig,
  type GenesisPassManageState,
} from "@/app/project/[slug]/manage/genesis-pass-actions";
import type { Collection } from "@/types/collection";

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso.trim());
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GenesisPassNftConfigForm({ collection: c }: { collection: Collection }) {
  const g = c.genesisPassNft;
  const [state, action, pending] = useActionState<GenesisPassManageState, FormData>(
    updateGenesisPassNftConfig,
    genesisPassManageInitialState,
  );
  const [showAdvanced, setShowAdvanced] = useState(!!g?.traitConfig);

  const initialJson = useMemo(() => {
    if (!g?.traitConfig) return "";
    try {
      return JSON.stringify(g.traitConfig, null, 2);
    } catch {
      return "";
    }
  }, [g?.traitConfig]);

  return (
    <div className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Generative Genesis Pass</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Trait config & reveal</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            Off-chain display only — does not change MintReceipt, claims, or holder math. Point{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[10px]">traitConfigUri</code> at a hosted{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[10px]">trait-config.json</code> (see repo
            example). Optional reveal time hides generative traits in metadata until then.
          </p>
        </div>
      </div>

      {state.message ? (
        <p
          className={`mt-4 rounded-xl border p-3 text-sm ${
            state.ok ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200" : "border-rose-400/30 bg-rose-400/5 text-rose-200"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="slug" value={c.slug} />

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Reveal at (local time)</span>
          <input
            type="datetime-local"
            name="revealAtLocal"
            defaultValue={toDatetimeLocalValue(g?.revealAt)}
            className="w-full max-w-md rounded-xl border border-line bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="clearRevealAt" value="1" className="rounded border-line" />
          Clear reveal schedule (always show generative metadata when trait config exists)
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Placeholder image (https)</span>
          <input
            type="url"
            name="placeholderImageUrl"
            defaultValue={g?.placeholderImageUrl ?? ""}
            placeholder="https://…"
            className="w-full rounded-xl border border-line bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Trait config URI (https)</span>
          <input
            type="url"
            name="traitConfigUri"
            defaultValue={g?.traitConfigUri ?? ""}
            placeholder="https://…/trait-config.json"
            className="w-full rounded-xl border border-line bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            name="allowDynamicPostReveal"
            value="1"
            defaultChecked={!!g?.allowDynamicPostReveal}
            className="rounded border-line"
          />
          Allow dynamic metadata URL after reveal (prefer pinning + Core URI update for production)
        </label>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs font-medium text-accent underline-offset-2 hover:underline"
        >
          {showAdvanced ? "Hide advanced" : "Advanced · inline trait JSON"}
        </button>

        {showAdvanced ? (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Inline trait config (optional, validated server-side)
            </span>
            <textarea
              name="traitConfigJson"
              rows={10}
              defaultValue={initialJson}
              placeholder='{ "schemaVersion": 1, "width": 1200, "height": 1200, "layers": […] }'
              className="w-full rounded-xl border border-line bg-black/30 px-3 py-2 font-mono text-[11px] text-white"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="clearInlineTraitConfig" value="1" className="rounded border-line" />
              Remove inline JSON (keep URI only)
            </label>
          </label>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Genesis Pass NFT settings"}
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-[11px] text-muted">Danger zone</p>
          <button
            type="submit"
            name="clearGenesisPass"
            value="1"
            disabled={pending}
            className="mt-2 rounded-full border border-rose-400/40 px-4 py-2 text-xs font-medium text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
          >
            Clear all generative settings
          </button>
        </div>
      </form>
    </div>
  );
}
