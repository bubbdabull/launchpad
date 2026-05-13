"use client";

import { useCallback, useId, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-muted/60";
const textareaClass =
  "w-full min-h-[220px] rounded-xl border border-line bg-ink px-3 py-3 font-mono text-[11px] leading-relaxed text-white placeholder:text-muted/60";

function Gl({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-white/90">
      {children}
    </label>
  );
}

/**
 * Optional generative / reveal fields on create. Trait rules are saved on the launch
 * (`genesis_pass_config.traitConfig`) when you paste or load JSON — no external link required.
 */
export function GenesisGenerativeFields() {
  const base = useId();
  const traitFileId = `${base}-trait-json-file`;
  const phFileId = `${base}-placeholder-img`;
  const hostedTraitFileId = `${base}-hosted-trait-upload`;

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
        <h3 className="mt-1 font-display text-base font-semibold text-white">Trait config &amp; rarity listings</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Skip this block if you are not using generative traits. Trait rules are stored on this launch when you paste
          or load valid JSON (schema in{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-[10px]">src/lib/nft-generation/schema/</code>
          ). Reveal time, placeholder image, and rarity links still use public{" "}
          <span className="font-mono text-[10px] text-white/90">https://</span> URLs where noted. Build assets with{" "}
          <span className="font-mono text-[10px] text-white/90">npm run generate:genesis</span>.
        </p>
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      <div className="space-y-1.5">
        <Gl htmlFor={`${base}-trait-json`}>Trait config JSON (optional, saved on the launch)</Gl>
        <textarea
          id={`${base}-trait-json`}
          name="genesisTraitConfigJson"
          value={traitJson}
          onChange={(e) => setTraitJson(e.target.value)}
          placeholder='{ "schemaVersion": 1, "width": 1200, "height": 1200, "layers": [ … ] }'
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

      <button
        type="button"
        onClick={() => setShowHostedTrait((v) => !v)}
        className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
      >
        {showHostedTrait ? "Hide" : "Optional instead:"} hosted trait-config.json URL (CDN / pinning)
      </button>

      {traitUri.trim() !== "" && !showHostedTrait ? (
        <input type="hidden" name="genesisTraitConfigUri" value={traitUri} />
      ) : null}

      {showHostedTrait ? (
        <div className="space-y-2 rounded-xl border border-line/80 bg-black/20 p-4">
          <p className="text-[10px] text-muted">
            Use this only if you are not using the editor above. If both are filled, the inline JSON wins.
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
          <Gl htmlFor={`${base}-placeholder`}>Placeholder while unrevealed (optional)</Gl>
          <p className="text-[10px] text-muted">Upload an image or paste a public https image URL.</p>
          <input
            id={`${base}-placeholder`}
            type="text"
            name="genesisPlaceholderImageUrl"
            value={placeholderUri}
            onChange={(e) => setPlaceholderUri(e.target.value)}
            placeholder="https://…/hidden.png"
            autoComplete="off"
            className={inputClass}
          />
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
              {phBusy ? "Uploading…" : "Upload placeholder image"}
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
        <p className="text-[10px] text-muted">RareNFT, MoonRank, HowRare, or any https rankings link.</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="genesisAllowDynamicPostReveal" value="1" className="rounded border-line" />
        Allow dynamic metadata URL after reveal (advanced; prefer pinning for production)
      </label>
    </div>
  );
}
