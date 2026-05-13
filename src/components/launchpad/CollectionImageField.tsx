"use client";

import { useCallback, useId, useState } from "react";

import { humanCollectionImageOutputLabel } from "@/lib/images/collection-image-output-spec";

type FieldName = "bannerUrl" | "logoUrl";

type Props = {
  name: FieldName;
  label: string;
  /** Short line under the title (aspect ratio, use case). */
  description: string;
  /** Tailwind aspect ratio for the preview frame, e.g. aspect-[21/9] */
  aspectClass: string;
  /** Controlled mode (e.g. manage page): parent owns the https URL. */
  value?: string;
  onUrlChange?: (url: string) => void;
};

const kindForName = (name: FieldName): "banner" | "logo" =>
  name === "bannerUrl" ? "banner" : "logo";

export function CollectionImageField({
  name,
  label,
  description,
  aspectClass,
  value: controlledValue,
  onUrlChange,
}: Props) {
  const isControlled = onUrlChange !== undefined && controlledValue !== undefined;
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
  const fileId = `${base}-file`;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const kind = kindForName(name);
  const outputLabel = humanCollectionImageOutputLabel(kind);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        const res = await fetch("/api/upload/collection-asset", { method: "POST", body: fd });
        const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
        if (!res.ok || !data.ok || !data.publicUrl) {
          throw new Error(data.error ?? "Upload didn’t complete.");
        }
        setUrl(data.publicUrl);
        setPasteOpen(false);
        setDraft("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setUploading(false);
      }
    },
    [kind, setUrl],
  );

  function applyPastedUrl() {
    setError(null);
    const u = draft.trim();
    if (!/^https:\/\/.+/i.test(u)) {
      setError("Enter a full https:// image URL.");
      return;
    }
    setUrl(u);
    setDraft("");
    setPasteOpen(false);
  }

  const pillBtn =
    "inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25";

  const uploadVerb = url ? "Replace image" : "Upload image";

  return (
    <div className="space-y-4 rounded-xl border border-line bg-panel/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{description}</p>
        <div className="mt-2 space-y-1 text-[10px] leading-snug text-muted/90">
          <p>
            <span className="text-muted">Normalized for metadata:</span>{" "}
            <span className="font-mono text-[10px] text-accent/90">{outputLabel}</span>
          </p>
          <p className="text-muted/85">Source: JPEG, PNG, WebP, or GIF · up to 5&nbsp;MB</p>
        </div>
      </div>

      {url ? (
        <div
          className={`relative overflow-hidden rounded-xl border border-line bg-black/30 ${aspectClass} w-full max-w-full`}
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <p className="text-xs text-muted">No image yet. Use upload or paste link.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className={`relative inline-flex shrink-0 self-start ${uploading ? "pointer-events-none opacity-50" : ""}`}>
          <input
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label={uploadVerb}
            className="absolute inset-0 z-10 h-full min-h-[2.5rem] w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = "";
            }}
          />
          <span className={`${pillBtn} pointer-events-none min-h-[2.5rem] px-5`}>
            {uploading ? "Uploading…" : uploadVerb}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setPasteOpen((o) => !o);
            setError(null);
          }}
          className="shrink-0 self-start rounded-full border border-transparent px-1 py-2 text-left text-xs font-medium text-accent/90 hover:text-accent sm:py-2"
        >
          {pasteOpen ? "Hide paste field" : "Paste https link"}
        </button>
        {url ? (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              setDraft("");
              setError(null);
            }}
            className="shrink-0 self-start rounded-full border border-transparent px-1 py-2 text-left text-xs font-medium text-rose-300/90 hover:text-rose-200 sm:py-2"
          >
            Remove
          </button>
        ) : null}
      </div>

      {pasteOpen ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="https://…/art.png"
            className="w-full flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-muted/60"
          />
          <button
            type="button"
            onClick={applyPastedUrl}
            className="shrink-0 rounded-full border border-line bg-panel px-4 py-2.5 text-xs font-semibold text-white hover:border-white/25"
          >
            Apply link
          </button>
        </div>
      ) : null}

      <input type="hidden" name={name} value={url} />
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
