"use client";

import { useActionState, useCallback, useEffect, useState } from "react";

import {
  genesisPassManageInitialState,
  updateGenesisPassNftConfig,
  type GenesisPassManageState,
} from "@/app/project/[slug]/manage/genesis-pass-actions";
import { GENESIS_BUILTIN_PRESET_OPTIONS } from "@/lib/nft-generation/presets/built-in-genesis-presets";
import type { Collection } from "@/types/collection";

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso.trim());
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function serializeTraitConfig(g: Collection["genesisPassNft"]): string {
  if (!g?.traitConfig) return "";
  try {
    return JSON.stringify(g.traitConfig, null, 2);
  } catch {
    return "";
  }
}

export function GenesisPassNftConfigForm({ collection: c }: { collection: Collection }) {
  const g = c.genesisPassNft;
  const [state, action, pending] = useActionState<GenesisPassManageState, FormData>(
    updateGenesisPassNftConfig,
    genesisPassManageInitialState,
  );
  const [traitDraft, setTraitDraft] = useState(() => serializeTraitConfig(g));
  const [showHostedUri, setShowHostedUri] = useState(!!g?.traitConfigUri && !g?.traitConfig);
  const [hostedUri, setHostedUri] = useState(g?.traitConfigUri ?? "");
  const [traitFileHint, setTraitFileHint] = useState<string | null>(null);
  const [placeholderUrl, setPlaceholderUrl] = useState(g?.placeholderImageUrl ?? "");
  const [phBusy, setPhBusy] = useState(false);
  const [phHint, setPhHint] = useState<string | null>(null);

  const uploadPlaceholderImage = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "gallery");
    const res = await fetch("/api/upload/collection-asset", { method: "POST", body: fd });
    const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
    if (!res.ok || !data.ok || !data.publicUrl) {
      throw new Error(data.error ?? "Upload didn’t complete.");
    }
    setPlaceholderUrl(data.publicUrl);
  }, []);

  useEffect(() => {
    setTraitDraft(serializeTraitConfig(g));
    setHostedUri(g?.traitConfigUri ?? "");
    setShowHostedUri(!!g?.traitConfigUri && !g?.traitConfig);
    setPlaceholderUrl(g?.placeholderImageUrl ?? "");
  }, [g?.traitConfig, g?.traitConfigUri, g?.placeholderImageUrl, c.slug]);

  useEffect(() => {
    if (state.ok && state.message) {
      setPhHint(null);
      setTraitFileHint(null);
    }
  }, [state.ok, state.message]);

  const inputClass = "w-full rounded-xl border border-line bg-black/30 px-3 py-2 text-sm text-white";
  const textareaClass =
    "w-full min-h-[240px] rounded-xl border border-line bg-black/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-white";

  return (
    <div id="genesis-pass-traits" className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Generative Genesis Pass</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Trait config & reveal</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            Off-chain display only — does not change MintReceipt, claims, or holder math. Trait rules are stored on this
            launch when you paste or load JSON below (no external link required). Optional reveal time hides
            generative traits until then. Add a rarity listing URL for RareNFT, MoonRank, HowRare, or your own rankings
            page — mint and launch pages show it as a link only.
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
            className={`${inputClass} max-w-md`}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="clearRevealAt" value="1" className="rounded border-line" />
          Clear reveal schedule (always show generative metadata when trait config exists)
        </label>

        <div className="space-y-1.5">
          <label htmlFor={`placeholder-file-${c.slug}`} className="block text-[11px] font-medium uppercase tracking-wider text-muted">
            Placeholder while unrevealed (optional)
          </label>
          <p className="text-[10px] text-muted">JPEG, PNG, WebP, or GIF — upload only.</p>
          {phHint ? <p className="text-xs text-rose-300">{phHint}</p> : null}
          <input type="hidden" name="placeholderImageUrl" value={placeholderUrl} />
          {placeholderUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded preview URL */}
              <img src={placeholderUrl} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
              <button
                type="button"
                onClick={() => setPlaceholderUrl("")}
                className="text-[11px] font-medium text-muted underline-offset-2 hover:text-white hover:underline"
              >
                Remove image
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              id={`placeholder-file-${c.slug}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={pending || phBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setPhHint(null);
                void (async () => {
                  setPhBusy(true);
                  try {
                    await uploadPlaceholderImage(f);
                  } catch (err) {
                    setPhHint(err instanceof Error ? err.message : "Upload failed.");
                  } finally {
                    setPhBusy(false);
                  }
                })();
              }}
            />
            <label
              htmlFor={`placeholder-file-${c.slug}`}
              className={`inline-flex cursor-pointer rounded-lg border border-line bg-black/30 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-black/50 ${
                pending || phBusy ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {phBusy ? "Uploading…" : placeholderUrl ? "Replace image" : "Upload placeholder image"}
            </label>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Rarity listing URL (https) — RareNFT, MoonRank, HowRare, …
          </span>
          <input
            type="text"
            name="rarityListingUrl"
            defaultValue={g?.rarityListingUrl ?? ""}
            placeholder="https://…"
            className={inputClass}
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

        <div className="space-y-1.5 rounded-lg border border-accent/25 bg-accent/[0.06] p-3 text-xs text-muted">
          <label htmlFor={`apply-preset-${c.slug}`} className="block font-medium text-white/90">
            Replace traits with a built-in preset
          </label>
          <p className="text-[10px] leading-relaxed">
            Three weighted layers with images served from this app. Choosing a preset ignores the JSON box on submit. If
            save fails, the deployment may not know its public URL yet — use custom JSON or ask your host to fix that.
          </p>
          <select
            id={`apply-preset-${c.slug}`}
            name="applyGenesisTraitPreset"
            defaultValue=""
            className="w-full max-w-lg rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          >
            <option value="">— No preset (keep JSON / URL below) —</option>
            {GENESIS_BUILTIN_PRESET_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {o.blurb}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 border-t border-white/10 pt-4">
          {traitFileHint ? <p className="text-xs text-rose-300">{traitFileHint}</p> : null}
          <span className="block text-[11px] font-medium uppercase tracking-wider text-muted">
            Trait config JSON (saved on this launch)
          </span>
          <textarea
            name="traitConfigJson"
            value={traitDraft}
            onChange={(e) => setTraitDraft(e.target.value)}
            spellCheck={false}
            placeholder='{ "schemaVersion": 1, "width": 1200, "height": 1200, "layers": [ … ] }'
            className={textareaClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`trait-file-${c.slug}`}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setTraitFileHint(null);
                void f.text().then(
                  (text) => {
                    try {
                      JSON.parse(text);
                      setTraitDraft(text);
                    } catch {
                      setTraitFileHint("That file is not valid JSON.");
                    }
                  },
                  () => setTraitFileHint("Could not read the file."),
                );
              }}
            />
            <label
              htmlFor={`trait-file-${c.slug}`}
              className={`inline-flex cursor-pointer rounded-lg border border-line bg-black/30 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-black/50 ${
                pending ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Load JSON file
            </label>
            {traitDraft ? (
              <button
                type="button"
                onClick={() => setTraitDraft("")}
                className="text-[11px] font-medium text-muted underline-offset-2 hover:text-white hover:underline"
              >
                Clear JSON
              </button>
            ) : null}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="clearInlineTraitConfig" value="1" className="rounded border-line" />
            Remove saved inline JSON (use hosted URL only, if configured below)
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowHostedUri((v) => !v)}
          className="text-xs font-medium text-accent underline-offset-2 hover:underline"
        >
          {showHostedUri ? "Hide" : "Optional:"} hosted trait-config.json URL (CDN / pinning)
        </button>

        {hostedUri.trim() !== "" && !showHostedUri ? (
          <input type="hidden" name="traitConfigUri" value={hostedUri} />
        ) : null}

        {showHostedUri ? (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Trait config URL (https)</span>
            <input
              type="text"
              name="traitConfigUri"
              value={hostedUri}
              onChange={(e) => setHostedUri(e.target.value)}
              placeholder="https://…/trait-config.json"
              className={inputClass}
            />
            <p className="text-[10px] text-muted">
              If both URL and inline JSON are provided, inline JSON is saved and the URL is cleared.
            </p>
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
