"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import {
  BLOCK_TYPES,
  HERO_LAYOUTS,
  isValidAccentColor,
  makeEmptyBlock,
  parseYouTubeId,
  type FaqItem,
  type GalleryItem,
  type ProjectPageBlock,
  type ProjectPageDoc,
  type RoadmapItem,
  type RoadmapStatus,
} from "@/lib/launch/project-page";

export type ProjectPageFormFieldsProps = {
  doc: ProjectPageDoc;
  setDoc: Dispatch<SetStateAction<ProjectPageDoc>>;
  accentColor: string;
  setAccentColor: (v: string) => void;
  heroLayout: string;
  setHeroLayout: (v: string) => void;
  projectHeadline: string;
  setProjectHeadline: (v: string) => void;
  projectSubhead: string;
  setProjectSubhead: (v: string) => void;
  namePlaceholder: string;
  taglinePlaceholder: string;
  /** Avoid radio name collisions when two editors could mount (create uses its own group). */
  heroLayoutRadioName?: string;
};

export function ProjectPageFormFields({
  doc,
  setDoc,
  accentColor,
  setAccentColor,
  heroLayout,
  setHeroLayout,
  projectHeadline,
  setProjectHeadline,
  projectSubhead,
  setProjectSubhead,
  namePlaceholder,
  taglinePlaceholder,
  heroLayoutRadioName = "heroLayoutPicker",
}: ProjectPageFormFieldsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const accentValid = !accentColor || isValidAccentColor(accentColor);

  function patchBlock(id: string, patch: (b: ProjectPageBlock) => ProjectPageBlock) {
    setDoc((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? patch(b) : b)),
    }));
  }
  function removeBlock(id: string) {
    setDoc((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
  }
  function moveBlock(id: string, dir: -1 | 1) {
    setDoc((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return d;
      const next = idx + dir;
      if (next < 0 || next >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      const [item] = blocks.splice(idx, 1);
      blocks.splice(next, 0, item);
      return { ...d, blocks };
    });
  }
  function addBlock(type: ProjectPageBlock["type"]) {
    setDoc((d) => ({ ...d, blocks: [...d.blocks, makeEmptyBlock(type)] }));
    setPickerOpen(false);
  }

  return (
    <>
      <section className="space-y-5 rounded-2xl border border-line bg-panel/40 p-6">
        <SectionHeader
          title="Theme + hero"
          sub="Visible on the project page only. The home grid + trade page keep platform defaults."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Accent color (hex)" sub="e.g. #7CFFB2. Leave empty for the platform default.">
            <div className="flex items-center gap-2">
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#7CFFB2"
                className={`w-full rounded-lg border bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2 ${
                  accentValid ? "border-line" : "border-rose-400/40"
                }`}
              />
              <span
                aria-hidden
                className="inline-block h-9 w-9 shrink-0 rounded-lg border border-line"
                style={{ backgroundColor: accentValid && accentColor ? accentColor : "transparent" }}
              />
            </div>
            {!accentValid ? (
              <p className="text-[11px] text-rose-300">Hex must look like #abc or #aabbcc.</p>
            ) : null}
          </Field>
          <Field label="Hero layout">
            <div className="grid gap-2">
              {HERO_LAYOUTS.map((h) => (
                <label
                  key={h.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                    heroLayout === h.key
                      ? "border-accent/40 bg-accent/[0.04]"
                      : "border-line bg-ink hover:border-white/15"
                  }`}
                >
                  <input
                    type="radio"
                    name={heroLayoutRadioName}
                    value={h.key}
                    checked={heroLayout === h.key}
                    onChange={() => setHeroLayout(h.key)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{h.label}</p>
                    <p className="text-[11px] text-muted">{h.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Project-page headline (optional)"
            sub="Overrides the launch name on /project/[slug] only."
          >
            <input
              value={projectHeadline}
              onChange={(e) => setProjectHeadline(e.target.value)}
              maxLength={200}
              placeholder={namePlaceholder}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <Field
            label="Project-page subhead (optional)"
            sub="Overrides the tagline on /project/[slug] only."
          >
            <input
              value={projectSubhead}
              onChange={(e) => setProjectSubhead(e.target.value)}
              maxLength={400}
              placeholder={taglinePlaceholder}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-panel/40 p-6">
        <SectionHeader title="Default sections" sub="Toggle off if your custom blocks already cover them." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Hide default description + utilities"
            checked={!!doc.hideDefaultDescription}
            onChange={(v) => setDoc((d) => ({ ...d, hideDefaultDescription: v }))}
          />
          <Toggle
            label="Hide default stats grid"
            checked={!!doc.hideDefaultStats}
            onChange={(v) => setDoc((d) => ({ ...d, hideDefaultStats: v }))}
          />
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-panel/40 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <SectionHeader title="Story blocks" sub="Reorder, edit, or remove. Up to 30 blocks per page." />
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:brightness-110"
            >
              + Add block
            </button>
            {pickerOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-ink shadow-card">
                <div className="max-h-72 overflow-y-auto py-1">
                  {BLOCK_TYPES.map((bt) => (
                    <button
                      type="button"
                      key={bt.key}
                      onClick={() => addBlock(bt.key)}
                      className="block w-full px-4 py-3 text-left transition hover:bg-panel/60"
                    >
                      <p className="text-sm font-medium text-white">{bt.label}</p>
                      <p className="text-[11px] text-muted">{bt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {doc.blocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-ink/40 p-8 text-center text-sm text-muted">
            No custom blocks yet. Click <span className="text-accent">+ Add block</span> above to start telling your
            story.
          </div>
        ) : (
          <div className="space-y-3">
            {doc.blocks.map((block, i) => (
              <BlockEditor
                key={block.id}
                block={block}
                isFirst={i === 0}
                isLast={i === doc.blocks.length - 1}
                onChange={(patch) => patchBlock(block.id, () => ({ ...patch, id: block.id } as ProjectPageBlock))}
                onMove={(dir) => moveBlock(block.id, dir)}
                onRemove={() => removeBlock(block.id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function BlockEditor({
  block,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  block: ProjectPageBlock;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: ProjectPageBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-ink/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{block.type}</p>
        <div className="flex gap-2">
          <SmallBtn onClick={() => onMove(-1)} disabled={isFirst}>
            ↑
          </SmallBtn>
          <SmallBtn onClick={() => onMove(1)} disabled={isLast}>
            ↓
          </SmallBtn>
          <SmallBtn onClick={onRemove} tone="danger">
            Remove
          </SmallBtn>
        </div>
      </div>

      <div className="mt-3">
        <BlockBody block={block} onChange={onChange} />
      </div>
    </div>
  );
}

function BlockBody({
  block,
  onChange,
}: {
  block: ProjectPageBlock;
  onChange: (next: ProjectPageBlock) => void;
}) {
  if (block.type === "text") {
    return (
      <div className="space-y-3">
        <Field label="Heading (optional)">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onChange({ ...block, heading: e.target.value })}
            maxLength={200}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Body" sub="Plain text. Double-newline for paragraphs.">
          <textarea
            rows={5}
            value={block.body}
            onChange={(e) => onChange({ ...block, body: e.target.value })}
            maxLength={4000}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="space-y-3">
        <Field label="Image URL (https://)">
          <input
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="https://.../image.jpg"
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
        {block.url ? (
          <div className="overflow-hidden rounded-xl border border-line bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.url} alt="" className="block max-h-72 w-full object-cover" />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Caption (optional)">
            <input
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              maxLength={200}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Width">
            <select
              value={block.width}
              onChange={(e) =>
                onChange({
                  ...block,
                  width: (e.target.value as "contained" | "wide" | "full") ?? "contained",
                })
              }
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            >
              <option value="contained">Contained · max 768px</option>
              <option value="wide">Wide · max 1024px</option>
              <option value="full">Full bleed</option>
            </select>
          </Field>
        </div>
      </div>
    );
  }

  if (block.type === "gallery") {
    const items: GalleryItem[] = block.items;
    const setItems = (next: GalleryItem[]) => onChange({ ...block, items: next });
    return (
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line bg-panel/40 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={it.url}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], url: e.target.value };
                setItems(next);
              }}
              placeholder="https://.../gallery-1.jpg"
              className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            />
            <input
              value={it.caption ?? ""}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], caption: e.target.value };
                setItems(next);
              }}
              placeholder="Caption (optional)"
              maxLength={200}
              className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            />
            <SmallBtn
              tone="danger"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              disabled={items.length === 1}
            >
              Remove
            </SmallBtn>
          </div>
        ))}
        <SmallBtn onClick={() => setItems([...items, { url: "", caption: "" }])} disabled={items.length >= 12}>
          + Add image
        </SmallBtn>
      </div>
    );
  }

  if (block.type === "faq") {
    const items: FaqItem[] = block.items;
    const setItems = (next: FaqItem[]) => onChange({ ...block, items: next });
    return (
      <div className="space-y-3">
        <Field label="Heading (optional)">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onChange({ ...block, heading: e.target.value })}
            maxLength={200}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
        {items.map((it, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line bg-panel/40 p-3">
            <input
              value={it.question}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], question: e.target.value };
                setItems(next);
              }}
              placeholder="Question"
              maxLength={500}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            />
            <textarea
              rows={3}
              value={it.answer}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], answer: e.target.value };
                setItems(next);
              }}
              placeholder="Answer"
              maxLength={500}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            />
            <div className="flex justify-end">
              <SmallBtn
                tone="danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                disabled={items.length === 1}
              >
                Remove
              </SmallBtn>
            </div>
          </div>
        ))}
        <SmallBtn onClick={() => setItems([...items, { question: "", answer: "" }])} disabled={items.length >= 30}>
          + Add Q&amp;A
        </SmallBtn>
      </div>
    );
  }

  if (block.type === "roadmap") {
    const items: RoadmapItem[] = block.items;
    const setItems = (next: RoadmapItem[]) => onChange({ ...block, items: next });
    return (
      <div className="space-y-3">
        <Field label="Heading (optional)">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onChange({ ...block, heading: e.target.value })}
            maxLength={200}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
        {items.map((it, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line bg-panel/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={it.title}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], title: e.target.value };
                  setItems(next);
                }}
                placeholder="Milestone title"
                maxLength={120}
                className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
              />
              <select
                value={it.status}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], status: e.target.value as RoadmapStatus };
                  setItems(next);
                }}
                className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={it.description ?? ""}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], description: e.target.value };
                setItems(next);
              }}
              placeholder="Description (optional)"
              maxLength={500}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
            />
            <div className="flex justify-end">
              <SmallBtn
                tone="danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                disabled={items.length === 1}
              >
                Remove
              </SmallBtn>
            </div>
          </div>
        ))}
        <SmallBtn
          onClick={() => setItems([...items, { title: "", description: "", status: "planned" }])}
          disabled={items.length >= 30}
        >
          + Add milestone
        </SmallBtn>
      </div>
    );
  }

  if (block.type === "embed") {
    const parsed = block.youtubeId ? parseYouTubeId(block.youtubeId) : null;
    return (
      <div className="space-y-3">
        <Field label="YouTube URL or video ID" sub="We extract the video ID from any YouTube URL.">
          <input
            value={block.youtubeId}
            onChange={(e) => onChange({ ...block, youtubeId: e.target.value })}
            placeholder="https://youtu.be/dQw4w9WgXcQ or dQw4w9WgXcQ"
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
        {parsed ? (
          <div className="overflow-hidden rounded-xl border border-line bg-ink">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${parsed}`}
              className="block aspect-video w-full"
              title="Preview"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : block.youtubeId ? (
          <p className="text-[11px] text-rose-300">Couldn&rsquo;t parse a YouTube video ID from that input.</p>
        ) : null}
        <Field label="Caption (optional)">
          <input
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            maxLength={200}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
          />
        </Field>
      </div>
    );
  }

  return null;
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="font-display text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Field({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      {children}
      {sub ? <p className="text-[11px] text-muted">{sub}</p> : null}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm text-white">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function SmallBtn({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "danger";
  disabled?: boolean;
}) {
  const cls =
    tone === "danger"
      ? "border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
      : "border-line text-muted hover:text-white hover:border-white/20";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}
