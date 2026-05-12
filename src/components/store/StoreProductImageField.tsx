"use client";

import { useCallback, useId, useState } from "react";

type Props = {
  label?: string;
};

export function StoreProductImageField({ label = "Product photo" }: Props) {
  const base = useId();
  const fileInputId = `${base}-file`;
  const pasteInputId = `${base}-paste`;
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "store");
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
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={pasteMode ? pasteInputId : fileInputId} className="text-sm font-medium text-white">
          {label}
        </label>
        <button
          type="button"
          onClick={() => {
            setPasteMode((p) => !p);
            setError(null);
          }}
          className="text-xs font-medium text-accent/90 hover:text-accent"
        >
          {pasteMode ? "Upload file" : "Paste image link"}
        </button>
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
          className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white"
        />
      ) : (
        <div className="relative flex aspect-video max-h-40 w-full max-w-md items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.02]">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="px-4 text-center text-sm text-muted">{uploading ? "Uploading…" : "Drop or click to upload"}</p>
          )}
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      <input type="hidden" name="image_url" value={url} />
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
