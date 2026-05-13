"use client";

import { useCallback, useId, useState } from "react";

type FieldName = "bannerUrl" | "logoUrl";

type Props = {
  name: FieldName;
  label: string;
  description: string;
  /** Tailwind aspect ratio e.g. aspect-[21:9] */
  aspectClass: string;
  /** When set with `aiLaunchName`, shows a “Generate with AI” action (DALL·E 3 → your Supabase bucket). */
  aiLaunchName?: string;
  aiTagline?: string;
  aiDescription?: string;
  aiStyleHint?: string;
  /** Controlled mode (e.g. manage page): parent owns the https URL. */
  value?: string;
  onUrlChange?: (url: string) => void;
};

export function CollectionImageField({
  name,
  label,
  description,
  aspectClass,
  aiLaunchName,
  aiTagline,
  aiDescription,
  aiStyleHint,
  value: controlledValue,
  onUrlChange,
}: Props) {
  const isControlled =
    onUrlChange !== undefined && controlledValue !== undefined;
  const [internalUrl, setInternalUrl] = useState("");
  const url = isControlled ? (controlledValue ?? "") : internalUrl;
  const setUrl = useCallback(
    (next: string) => {
      if (isControlled) onUrlChange(next);
      else setInternalUrl(next);
    },
    [isControlled, onUrlChange],
  );

  const base = useId();
  const fileInputId = `${base}-file`;
  const pasteInputId = `${base}-paste`;
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);

  const aiKind = name === "bannerUrl" ? "banner" : "logo";
  const showAi = Boolean(aiLaunchName?.trim());

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", name === "bannerUrl" ? "banner" : "logo");
        const res = await fetch("/api/upload/collection-asset", { method: "POST", body: fd });
        const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
        if (!res.ok || !data.ok || !data.publicUrl) {
          throw new Error(data.error ?? "Upload didn’t complete.");
        }
        setUrl(data.publicUrl);
        setPasteMode(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setUploading(false);
      }
    },
    [name, setUrl],
  );

  async function runAiGenerate() {
    if (!aiLaunchName?.trim()) {
      setError("Add a launch name first.");
      return;
    }
    setError(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/generate-launch-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: aiKind,
          launchName: aiLaunchName.trim(),
          tagline: aiTagline?.trim() ?? "",
          description: aiDescription?.trim() ?? "",
          styleHint: aiStyleHint?.trim() ?? "",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; publicUrl?: string; message?: string };
      const publicUrl = data.publicUrl;
      if (!res.ok || !data.ok || !publicUrl) {
        throw new Error(data.message ?? "AI image failed.");
      }
      setUrl(publicUrl);
      setPasteMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI image failed.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label htmlFor={pasteMode ? pasteInputId : fileInputId} className="text-sm font-medium text-white">
            {label}
          </label>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showAi ? (
            <button
              type="button"
              disabled={aiBusy || uploading}
              onClick={() => void runAiGenerate()}
              className="text-xs font-medium text-accent/90 hover:text-accent disabled:opacity-50"
            >
              {aiBusy ? "Generating…" : "Generate with AI"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setPasteMode((p) => !p);
              setError(null);
            }}
            className="text-xs font-medium text-accent/90 hover:text-accent"
          >
            {pasteMode ? "Upload file instead" : "Paste image link"}
          </button>
        </div>
      </div>

      {pasteMode ? (
        <input
          id={pasteInputId}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value.trim());
            setError(null);
          }}
          placeholder="https://…"
          className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-muted/70"
        />
      ) : (
        <div
          className={`relative overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.02] transition hover:border-white/25 ${aspectClass} w-full max-w-full`}
        >
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <p className="text-sm text-muted">
                {uploading ? "Uploading…" : "Drop an image here or tap to choose"}
              </p>
              <p className="text-[11px] text-muted/80">
                JPG, PNG, WebP, or GIF · up to 5 MB · saved as optimized PNG for on-chain metadata
              </p>
            </div>
          )}
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <input type="hidden" name={name} value={url} />
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
