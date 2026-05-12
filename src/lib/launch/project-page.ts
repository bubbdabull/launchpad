/**
 * Project-page document model.
 *
 * Every creator launch can attach a `ProjectPageDoc` that the public
 * /project/[slug] page renders. The doc is stored as JSONB on the
 * `collections` row. Validation + sanitization happens HERE — both the
 * server action and the page renderer call into these helpers, so
 * there's only one source of truth for what's allowed.
 *
 * Design rules:
 *   - All user-editable text is length-clamped at parse time.
 *   - Image URLs must be https://.
 *   - Block IDs are deterministic per-document so the editor can do
 *     stable up/down reordering.
 */

import type { Collection } from "@/types/collection";

const MAX_BLOCKS = 30;
const MAX_HEADING = 200;
const MAX_BODY = 4000;
const MAX_FAQ_ITEMS = 30;
const MAX_FAQ_TEXT = 500;
const MAX_ROADMAP_ITEMS = 30;
const MAX_ROADMAP_TITLE = 120;
const MAX_ROADMAP_DESCRIPTION = 500;
const MAX_GALLERY_ITEMS = 12;
const MAX_CAPTION = 200;
const MAX_URL = 1024;

export type TextBlock = {
  id: string;
  type: "text";
  heading?: string;
  body: string;
};

export type ImageBlock = {
  id: string;
  type: "image";
  url: string;
  caption?: string;
  width: "contained" | "wide" | "full";
};

export type GalleryItem = { url: string; caption?: string };
export type GalleryBlock = {
  id: string;
  type: "gallery";
  items: GalleryItem[];
};

export type FaqItem = { question: string; answer: string };
export type FaqBlock = {
  id: string;
  type: "faq";
  heading?: string;
  items: FaqItem[];
};

export type RoadmapStatus = "planned" | "in_progress" | "done";
export type RoadmapItem = {
  title: string;
  description?: string;
  status: RoadmapStatus;
};
export type RoadmapBlock = {
  id: string;
  type: "roadmap";
  heading?: string;
  items: RoadmapItem[];
};

export type EmbedBlock = {
  id: string;
  type: "embed";
  // YouTube video id (we extract from any pasted URL; never raw arbitrary HTML).
  youtubeId: string;
  caption?: string;
};

export type ProjectPageBlock =
  | TextBlock
  | ImageBlock
  | GalleryBlock
  | FaqBlock
  | RoadmapBlock
  | EmbedBlock;

export const BLOCK_TYPES: ReadonlyArray<{ key: ProjectPageBlock["type"]; label: string; sub: string }> = [
  { key: "text", label: "Text", sub: "Heading + paragraphs" },
  { key: "image", label: "Image", sub: "Single full-width image with caption" },
  { key: "gallery", label: "Gallery", sub: "2–12 image grid" },
  { key: "faq", label: "FAQ", sub: "Question / answer list" },
  { key: "roadmap", label: "Roadmap", sub: "Milestones with status" },
  { key: "embed", label: "YouTube embed", sub: "Video by URL" },
];

export type ProjectHeroLayout = "classic" | "minimal" | "split";
export const HERO_LAYOUTS: ReadonlyArray<{ key: ProjectHeroLayout; label: string; sub: string }> = [
  {
    key: "classic",
    label: "Classic",
    sub: "Banner + logo + headline overlay — showcases your art and framing (default).",
  },
  { key: "minimal", label: "Minimal", sub: "Small logo + headline; no banner overlay" },
  { key: "split", label: "Split", sub: "Banner on the left, content on the right" },
];

export type ProjectPageDoc = {
  blocks: ProjectPageBlock[];
  /** When true, hide the auto-rendered description section. */
  hideDefaultDescription?: boolean;
  /** When true, hide the auto-rendered stats grid (supply / minted / etc.). */
  hideDefaultStats?: boolean;
};

const HEX_COLOR_RE = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;
const ID_RE = /^[a-z0-9_-]{4,32}$/;
const HTTPS_RE = /^https:\/\/.+/;
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{8,15}$/;

function clampString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function clampOptional(v: unknown, max: number): string | undefined {
  const c = clampString(v, max);
  return c.length === 0 ? undefined : c;
}

function genId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36).slice(-4)}`;
}

function sanitizeUrl(v: unknown): string | null {
  const s = clampString(v, MAX_URL);
  if (!s) return null;
  if (!HTTPS_RE.test(s)) return null;
  return s;
}

/**
 * Extract a YouTube video id from common URL forms:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://youtube.com/embed/ID
 * Returns null if the URL doesn't look like YouTube.
 */
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Already a bare id?
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && YOUTUBE_ID_RE.test(v)) return v;
      const m = u.pathname.match(/\/embed\/([A-Za-z0-9_-]{8,15})/);
      if (m) return m[1];
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (YOUTUBE_ID_RE.test(id)) return id;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function sanitizeBlock(raw: unknown): ProjectPageBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  const id = typeof r.id === "string" && ID_RE.test(r.id) ? r.id : genId();

  if (type === "text") {
    const body = clampString(r.body, MAX_BODY);
    if (!body) return null;
    return {
      id,
      type: "text",
      heading: clampOptional(r.heading, MAX_HEADING),
      body,
    };
  }

  if (type === "image") {
    const url = sanitizeUrl(r.url);
    if (!url) return null;
    const widthRaw = typeof r.width === "string" ? r.width : "contained";
    const width: ImageBlock["width"] =
      widthRaw === "wide" || widthRaw === "full" ? widthRaw : "contained";
    return {
      id,
      type: "image",
      url,
      caption: clampOptional(r.caption, MAX_CAPTION),
      width,
    };
  }

  if (type === "gallery") {
    const itemsRaw = Array.isArray(r.items) ? r.items : [];
    const items: GalleryItem[] = [];
    for (const it of itemsRaw.slice(0, MAX_GALLERY_ITEMS)) {
      if (!it || typeof it !== "object") continue;
      const ir = it as Record<string, unknown>;
      const url = sanitizeUrl(ir.url);
      if (!url) continue;
      items.push({ url, caption: clampOptional(ir.caption, MAX_CAPTION) });
    }
    if (items.length === 0) return null;
    return { id, type: "gallery", items };
  }

  if (type === "faq") {
    const itemsRaw = Array.isArray(r.items) ? r.items : [];
    const items: FaqItem[] = [];
    for (const it of itemsRaw.slice(0, MAX_FAQ_ITEMS)) {
      if (!it || typeof it !== "object") continue;
      const ir = it as Record<string, unknown>;
      const question = clampString(ir.question, MAX_FAQ_TEXT);
      const answer = clampString(ir.answer, MAX_FAQ_TEXT);
      if (!question || !answer) continue;
      items.push({ question, answer });
    }
    if (items.length === 0) return null;
    return {
      id,
      type: "faq",
      heading: clampOptional(r.heading, MAX_HEADING),
      items,
    };
  }

  if (type === "roadmap") {
    const itemsRaw = Array.isArray(r.items) ? r.items : [];
    const items: RoadmapItem[] = [];
    for (const it of itemsRaw.slice(0, MAX_ROADMAP_ITEMS)) {
      if (!it || typeof it !== "object") continue;
      const ir = it as Record<string, unknown>;
      const title = clampString(ir.title, MAX_ROADMAP_TITLE);
      if (!title) continue;
      const statusRaw = typeof ir.status === "string" ? ir.status : "planned";
      const status: RoadmapStatus =
        statusRaw === "in_progress" || statusRaw === "done" ? statusRaw : "planned";
      items.push({
        title,
        description: clampOptional(ir.description, MAX_ROADMAP_DESCRIPTION),
        status,
      });
    }
    if (items.length === 0) return null;
    return {
      id,
      type: "roadmap",
      heading: clampOptional(r.heading, MAX_HEADING),
      items,
    };
  }

  if (type === "embed") {
    const youtubeId = parseYouTubeId(typeof r.youtubeId === "string" ? r.youtubeId : "");
    if (!youtubeId) return null;
    return {
      id,
      type: "embed",
      youtubeId,
      caption: clampOptional(r.caption, MAX_CAPTION),
    };
  }

  return null;
}

/**
 * Validate + sanitize an arbitrary JSON payload into a ProjectPageDoc.
 * Returns null when the payload is unusable (we treat that as "no page
 * builder customization", same as the column being NULL).
 */
export function sanitizeProjectPageDoc(raw: unknown): ProjectPageDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const blocksRaw = Array.isArray(r.blocks) ? r.blocks : [];
  const blocks: ProjectPageBlock[] = [];
  for (const b of blocksRaw.slice(0, MAX_BLOCKS)) {
    const block = sanitizeBlock(b);
    if (block) blocks.push(block);
  }
  // Always return a doc — even an empty doc is a valid "I cleared my page"
  // signal vs the column being NULL ("never customized").
  return {
    blocks,
    hideDefaultDescription: !!r.hideDefaultDescription,
    hideDefaultStats: !!r.hideDefaultStats,
  };
}

export function isValidAccentColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

/** Build a fresh, empty block of a given type. Used by the editor. */
export function makeEmptyBlock(type: ProjectPageBlock["type"]): ProjectPageBlock {
  const id = genId();
  switch (type) {
    case "text":
      return { id, type: "text", heading: "", body: "Tell people about your launch." };
    case "image":
      return { id, type: "image", url: "", caption: "", width: "contained" };
    case "gallery":
      return { id, type: "gallery", items: [{ url: "", caption: "" }] };
    case "faq":
      return {
        id,
        type: "faq",
        heading: "FAQ",
        items: [{ question: "", answer: "" }],
      };
    case "roadmap":
      return {
        id,
        type: "roadmap",
        heading: "Roadmap",
        items: [{ title: "", description: "", status: "planned" }],
      };
    case "embed":
      return { id, type: "embed", youtubeId: "", caption: "" };
  }
}

/**
 * Resolve theme settings on a Collection. Falls back to platform defaults.
 * Returns CSS-ready strings.
 */
export function resolveProjectPageTheme(c: Pick<Collection, "accentColor" | "heroLayout">) {
  return {
    accent: c.accentColor && isValidAccentColor(c.accentColor) ? c.accentColor : null,
    heroLayout: (c.heroLayout ?? "classic") as ProjectHeroLayout,
  };
}
