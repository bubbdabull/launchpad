"use client";

import { useCallback, useId, useState } from "react";

import {
  GENESIS_BUILTIN_PRESET_OPTIONS,
  type GenesisBuiltinTraitPresetId,
} from "@/lib/nft-generation/presets/built-in-genesis-presets";

const inputClass =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-muted/60";
const textareaClass =
  "w-full min-h-[200px] rounded-xl border border-line bg-ink px-3 py-3 font-mono text-[11px] leading-relaxed text-white placeholder:text-muted/60";
const selectClass =
  "mt-2 w-full max-w-md rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-white";

function Gl({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-white/90">
      {children}
    </label>
  );
}

type TraitMode = "off" | "builtin" | "custom";

/**
 * Optional generative / reveal fields on create. Creators can pick a built-in trait preset
 * (no JSON / rarity file) or supply their own JSON; reveal, placeholder, and rarity links stay optional.
 */
export function GenesisGenerativeFields() {
  const base = useId();
  const traitFileId = `${base}-trait-json-file`;
  const phFileId = `${base}-placeholder-img`;
  const hostedTraitFileId = `${base}-hosted-trait-upload`;

  const [traitMode, setTraitMode] = useState<TraitMode>("off");
  const [builtinPresetId, setBuiltinPresetId] = useState<GenesisBuiltinTraitPresetId>("starter");
  const [traitJson, setTraitJson] = useState("");
  const [traitUri, setTraitUri] = useState("");
  const [placeholderUri, setPlaceholderUri] = useState("");
  const [showHostedTrait, setShowHostedTrait] = useState(false);
  const [traitBusy, setTraitBusy] = useState(false);
  const [phBusy, setPhBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTraitFileIntoEditor = useCallback(async (file: File) => {
    const text = await file.text();
    JSON.parse(text);
    setTraitJson(text);
    setTraitMode("custom");
  }, []);

  const uploadHostedTraitJson = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "genesis-trait-config");
    const res = await fetch("/api/upload/collection-asset", { method: "POST", body: fd });
    const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
    if (!res.ok || !data.ok || !data.publicUrl) {
      throw new Error(data.error ?? "Upload didn’t complete.");
    }
    setTraitUri(data.publicUrl);
    setTraitMode("off");
    setTraitJson("");
  }, []);

  const uploadPlaceholderImage = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "gallery");
    const res = await fetch("/api/upload/collection-asset", { method: "POST", body: fd });
    const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
    if (!res.ok || !data.ok || !data.publicUrl) {
      throw new Error(data.error ?? "Upload didn’t complete.");
    }
    setPlaceholderUri(data.publicUrl);
  }, []);

  return (
    <div className="mt-8 space-y-4 rounded-2xl border border-white/[0.08] bg-black/25 p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Optional · generative variants</p>
        <h3 className="mt-1 font-display text-base font-semibold text-white">Traits &amp; rarity</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Skip this if you are not doing generative Genesis Pass art. You can use one of our{" "}
          <span className="text-white/85">built-in trait presets</span> (weighted random combos, images hosted here — no
          JSON file or rarity spreadsheet). Or paste your own trait JSON if you already built a collection. Reveal
          time, placeholder image, and external rarity links stay optional.
        </p>
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {traitMode === "builtin" ? (
        <input type="hidden" name="genesisTraitPreset" value={builtinPresetId} />
      ) : (
        <input type="hidden" name="genesisTraitPreset" value="" />
      )}

      <fieldset className="space-y-2">
        <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">Trait setup</legend>
        <label className="flex cursor-pointer items-start gap-2 text-[12px] text-muted">
          <input
            type="radio"
            name="_traitModeUi"
            checked={traitMode === "off"}
            onChange={() => {
              setTraitMode("off");
              setTraitJson("");
            }}
            className="mt-0.5"
          />
          <span>No generative traits</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[12px] text-muted">
          <input
            type="radio"
            name="_traitModeUi"
            checked={traitMode === "builtin"}
            onChange={() => {
              setTraitMode("builtin");
              setTraitJson("");
              setTraitUri("");
              setShowHostedTrait(false);
            }}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-white/90">Built-in preset</span> — pick a look below. We host the
            layer images on this app and roll weighted traits for you. This only works when the app knows its own public
            web address (your live deployment); if saving fails, use custom JSON or ask whoever runs this site to check
            hosting settings.
          </span>
        </label>
        {traitMode === "builtin" ? (
          <div className="ml-6 border-l border-white/10 pl-4">
            <label htmlFor={`${base}-preset`} className="text-[11px] font-medium text-muted">
              Preset
            </label>
            <select
              id={`${base}-preset`}
              value={builtinPresetId}
              onChange={(e) => setBuiltinPresetId(e.target.value as GenesisBuiltinTraitPresetId)}
              className={selectClass}
            >
              {GENESIS_BUILTIN_PRESET_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.blurb}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <label className="flex cursor-pointer items-start gap-2 text-[12px] text-muted">
          <input
            type="radio"
            name="_traitModeUi"
            checked={traitMode === "custom"}
            onChange={() => setTraitMode("custom")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-white/90">Custom JSON</span> — full control (see{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-[10px]">src/lib/nft-generation/schema/</code>
            ). You can still run <span className="font-mono text-[10px] text-white/90">npm run generate:genesis</span>{" "}
            for full collections offline.
          </span>
        </label>
      </fieldset>

      {traitMode === "custom" ? (
        <div className="space-y-1.5">
          <Gl htmlFor={`${base}-trait-json`}>Trait config JSON</Gl>
          <textarea
            id={`${base}-trait-json`}
            name="genesisTraitConfigJson"
            value={traitJson}
            onChange={(e) => setTraitJson(e.target.value)}
            placeholder='{ "schemaVersion": 1, "width": 800, "height": 800, "layers": [ … ] }'
            spellCheck={false}
            className={textareaClass}
          />
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <input
              id={traitFileId}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              disabled={traitBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void (async () => {
                  setError(null);
                  setTraitBusy(true);
                  try {
                    await loadTraitFileIntoEditor(f);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not read trait JSON file.");
                  } finally {
                    setTraitBusy(false);
                  }
                })();
              }}
            />
            <label
              htmlFor={traitFileId}
              className={`inline-flex cursor-pointer rounded-lg border border-line bg-panel/40 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-panel/60 ${
                traitBusy ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {traitBusy ? "Reading…" : "Load JSON file"}
            </label>
            {traitJson ? (
              <button
                type="button"
                onClick={() => setTraitJson("")}
                className="text-[11px] font-medium text-muted underline-offset-2 hover:text-white hover:underline"
              >
                Clear JSON
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowHostedTrait((v) => !v)}
        className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
      >
        {showHostedTrait ? "Hide" : "Advanced:"} hosted trait-config.json URL (CDN / pinning)
      </button>

      {traitUri.trim() !== "" && !showHostedTrait ? (
        <input type="hidden" name="genesisTraitConfigUri" value={traitUri} />
      ) : null}

      {showHostedTrait ? (
        <div className="space-y-2 rounded-xl border border-line/80 bg-black/20 p-4">
          <p className="text-[10px] text-muted">
            Only if you are not using a built-in preset or custom JSON above. Custom JSON wins if both are set.
          </p>
          <Gl htmlFor={`${base}-trait-uri`}>Hosted trait-config URL</Gl>
          <input
            id={`${base}-trait-uri`}
            type="text"
            name="genesisTraitConfigUri"
            value={traitUri}
            onChange={(e) => setTraitUri(e.target.value)}
            placeholder="https://…/trait-config.json"
            autoComplete="off"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={hostedTraitFileId}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              disabled={traitBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void (async () => {
                  setError(null);
                  setTraitBusy(true);
                  try {
                    await uploadHostedTraitJson(f);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Trait JSON upload failed.");
                  } finally {
                    setTraitBusy(false);
                  }
                })();
              }}
            />
            <label
              htmlFor={hostedTraitFileId}
              className={`inline-flex cursor-pointer rounded-lg border border-line bg-panel/40 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-panel/60 ${
                traitBusy ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {traitBusy ? "Uploading…" : "Upload JSON → https URL"}
            </label>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Gl htmlFor={phFileId}>Placeholder while unrevealed (optional)</Gl>
          <p className="text-[10px] text-muted">JPEG, PNG, WebP, or GIF — stored in your collection assets.</p>
          <input type="hidden" name="genesisPlaceholderImageUrl" value={placeholderUri} />
          {placeholderUri ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded preview URL */}
              <img src={placeholderUri} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
              <button
                type="button"
                onClick={() => setPlaceholderUri("")}
                className="text-[11px] font-medium text-muted underline-offset-2 hover:text-white hover:underline"
              >
                Remove image
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <input
              id={phFileId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={phBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void (async () => {
                  setError(null);
                  setPhBusy(true);
                  try {
                    await uploadPlaceholderImage(f);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Placeholder upload failed.");
                  } finally {
                    setPhBusy(false);
                  }
                })();
              }}
            />
            <label
              htmlFor={phFileId}
              className={`inline-flex cursor-pointer rounded-lg border border-line bg-panel/40 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-panel/60 ${
                phBusy ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {phBusy ? "Uploading…" : placeholderUri ? "Replace image" : "Upload placeholder image"}
            </label>
          </div>
        </div>
        <div className="space-y-1.5">
          <Gl htmlFor="genesis-reveal">Reveal at (local time, optional)</Gl>
          <input id="genesis-reveal" type="datetime-local" name="genesisRevealAtLocal" className={inputClass} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Gl htmlFor="genesis-rarity">Rarity page (optional)</Gl>
        <input
          id="genesis-rarity"
          type="text"
          name="genesisRarityListingUrl"
          placeholder="https://rarenft… or your rankings sheet"
          autoComplete="off"
          className={inputClass}
        />
        <p className="text-[10px] text-muted">Link only — not required for built-in presets.</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="genesisAllowDynamicPostReveal" value="1" className="rounded border-line" />
        Allow dynamic metadata URL after reveal (advanced; prefer pinning for production)
      </label>
    </div>
  );
}
