"use client";

import { useCallback, useId, useState, type Dispatch, type SetStateAction } from "react";

const MAX_GALLERY = 12;

type Props = {
  galleryUrls: string[];
  setGalleryUrls: Dispatch<SetStateAction<string[]>>;
  aiLaunchName: string;
  aiTagline: string;
  aiDescription: string;
  aiStyleHint: string;
  /** When false, still allow upload / paste; AI buttons stay disabled. */
  aiEnabled?: boolean;
};

export function LaunchGallerySection({
  galleryUrls,
  setGalleryUrls,
  aiLaunchName,
  aiTagline,
  aiDescription,
  aiStyleHint,
  aiEnabled = true,
}: Props) {
  const base = useId();
  const fileId = `${base}-gallery-file`;
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);

  const pushUploadedFile = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "gallery");
      const res = await fetch("/api/upload/collection-asset", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
      if (!res.ok || !data.ok || !data.publicUrl) {
        throw new Error(data.error ?? "Upload didn’t complete.");
      }
      const u = data.publicUrl;
      setGalleryUrls((prev) => {
        if (prev.length >= MAX_GALLERY || prev.includes(u)) return prev;
        return [...prev, u];
      });
      setPasteOpen(false);
    },
    [setGalleryUrls],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        await pushUploadedFile(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [pushUploadedFile],
  );

  async function runAiGallery() {
    if (!aiLaunchName.trim()) {
      setError("Add a launch name first.");
      return;
    }
    if (galleryUrls.length >= MAX_GALLERY) return;
    setError(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/generate-launch-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "gallery",
          launchName: aiLaunchName.trim(),
          tagline: aiTagline.trim(),
          description: aiDescription.trim(),
          styleHint: aiStyleHint.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; publicUrl?: string; message?: string };
      const publicUrl = data.publicUrl;
      if (!res.ok || !data.ok || !publicUrl) {
        throw new Error(data.message ?? "AI image failed.");
      }
      setGalleryUrls((prev) => {
        if (prev.includes(publicUrl) || prev.length >= MAX_GALLERY) return prev;
        return [...prev, publicUrl];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI image failed.");
    } finally {
      setAiBusy(false);
    }
  }

  function addDraftUrl() {
    setError(null);
    const u = draft.trim();
    if (!/^https:\/\/.+/i.test(u)) {
      setError("Enter a full https:// image URL.");
      return;
    }
    if (galleryUrls.length >= MAX_GALLERY) return;
    if (galleryUrls.includes(u)) return;
    setGalleryUrls((prev) => [...prev, u]);
    setDraft("");
  }

  return (
    <div className="space-y-4 rounded-xl border border-line bg-panel/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Gallery &amp; extras</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Uploads are converted to PNG; large images are shrunk so the long edge is at most 1600px (no upscaling). Optional https links still work.
          Up to {MAX_GALLERY} images go into on-chain metadata{" "}
          <code className="rounded bg-black/30 px-1 font-mono text-[10px]">properties.files</code>.
        </p>
      </div>

      {galleryUrls.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {galleryUrls.map((u, i) => (
            <li
              key={`${u}-${i}`}
              className="group relative h-20 w-20 overflow-hidden rounded-lg border border-line bg-black/30"
            >
              <img src={u} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                title="Remove"
                onClick={() => setGalleryUrls((prev) => prev.filter((_, j) => j !== i))}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={fileId}
          className={`cursor-pointer rounded-full border border-line bg-panel px-4 py-2 text-xs font-semibold text-white hover:border-white/25 ${
            uploading || galleryUrls.length >= MAX_GALLERY ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ? "Uploading…" : "Upload images"}
        </label>
        <input
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          disabled={uploading || galleryUrls.length >= MAX_GALLERY}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void (async () => {
              setError(null);
              setUploading(true);
              try {
                for (const f of files) {
                  await pushUploadedFile(f);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Upload failed.");
              } finally {
                setUploading(false);
              }
            })();
          }}
        />
        <button
          type="button"
          disabled={!aiEnabled || aiBusy || !aiLaunchName.trim() || galleryUrls.length >= MAX_GALLERY}
          onClick={() => void runAiGallery()}
          className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {aiBusy ? "Generating…" : "AI gallery image"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPasteOpen((o) => !o);
            setError(null);
          }}
          className="text-xs font-medium text-accent/90 hover:text-accent"
        >
          {pasteOpen ? "Hide link field" : "Paste image link"}
        </button>
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
            placeholder="https://…/extra-art.png"
            className="w-full flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-muted/60"
          />
          <button
            type="button"
            onClick={addDraftUrl}
            className="shrink-0 rounded-full border border-line bg-panel px-4 py-2.5 text-xs font-semibold text-white hover:border-white/25"
          >
            Add URL
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
