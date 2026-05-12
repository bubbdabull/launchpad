import type {
  FaqBlock,
  GalleryBlock,
  ImageBlock,
  ProjectPageBlock,
  RoadmapBlock,
  EmbedBlock,
  TextBlock,
} from "@/lib/launch/project-page";

/**
 * Renders the creator-authored block list on /project/[slug].
 *
 * Each block type is a small, deterministic React component — no client
 * JS. Blocks are display-only; the editor lives separately at
 * /project/[slug]/manage/page-editor.
 */
export function ProjectPageBlocks({ blocks }: { blocks: ProjectPageBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-12">
      {blocks.map((b) => (
        <BlockSwitch key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockSwitch({ block }: { block: ProjectPageBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlockView block={block} />;
    case "image":
      return <ImageBlockView block={block} />;
    case "gallery":
      return <GalleryBlockView block={block} />;
    case "faq":
      return <FaqBlockView block={block} />;
    case "roadmap":
      return <RoadmapBlockView block={block} />;
    case "embed":
      return <EmbedBlockView block={block} />;
  }
}

function TextBlockView({ block }: { block: TextBlock }) {
  // Render double-newline-separated paragraphs as <p>; preserve single
  // newlines as <br/>. No HTML allowed — this is plain text only.
  const paragraphs = block.body.split(/\n{2,}/g);
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      {block.heading ? (
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {block.heading}
        </h2>
      ) : null}
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

function ImageBlockView({ block }: { block: ImageBlock }) {
  const widthClass =
    block.width === "full"
      ? "w-full"
      : block.width === "wide"
        ? "mx-auto w-full max-w-5xl"
        : "mx-auto w-full max-w-3xl";
  return (
    <section className={widthClass}>
      <div className="overflow-hidden rounded-2xl border border-line bg-panel/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.url}
          alt={block.caption ?? ""}
          className="block h-auto w-full object-cover"
          loading="lazy"
        />
      </div>
      {block.caption ? (
        <p className="mt-2 text-center text-xs text-muted">{block.caption}</p>
      ) : null}
    </section>
  );
}

function GalleryBlockView({ block }: { block: GalleryBlock }) {
  const cols = block.items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className="mx-auto max-w-5xl">
      <div className={`grid grid-cols-1 gap-3 ${cols}`}>
        {block.items.map((it, i) => (
          <figure
            key={`${block.id}-${i}`}
            className="overflow-hidden rounded-2xl border border-line bg-panel/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.url}
              alt={it.caption ?? ""}
              className="block aspect-square h-auto w-full object-cover"
              loading="lazy"
            />
            {it.caption ? (
              <figcaption className="px-3 py-2 text-[11px] text-muted">{it.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

function FaqBlockView({ block }: { block: FaqBlock }) {
  return (
    <section className="mx-auto max-w-3xl">
      {block.heading ? (
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {block.heading}
        </h2>
      ) : null}
      <ul className="mt-4 space-y-3">
        {block.items.map((it, i) => (
          <li
            key={`${block.id}-${i}`}
            className="rounded-2xl border border-line bg-panel/40 p-5"
          >
            <p className="font-medium text-white">{it.question}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {it.answer}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoadmapBlockView({ block }: { block: RoadmapBlock }) {
  return (
    <section className="mx-auto max-w-3xl">
      {block.heading ? (
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {block.heading}
        </h2>
      ) : null}
      <ol className="mt-4 space-y-3">
        {block.items.map((it, i) => {
          const tone =
            it.status === "done"
              ? "border-emerald-400/30 bg-emerald-400/[0.04]"
              : it.status === "in_progress"
                ? "border-accent/30 bg-accent/[0.04]"
                : "border-line bg-panel/40";
          const pillTone =
            it.status === "done"
              ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"
              : it.status === "in_progress"
                ? "bg-accent/15 text-accent ring-accent/40"
                : "bg-white/5 text-muted ring-white/10";
          const label =
            it.status === "done" ? "Done" : it.status === "in_progress" ? "In progress" : "Planned";
          return (
            <li key={`${block.id}-${i}`} className={`rounded-2xl border p-5 ${tone}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-white">{it.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${pillTone}`}
                >
                  {label}
                </span>
              </div>
              {it.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {it.description}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EmbedBlockView({ block }: { block: EmbedBlock }) {
  return (
    <section className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-line bg-panel/40">
        <iframe
          className="block aspect-video w-full"
          src={`https://www.youtube-nocookie.com/embed/${block.youtubeId}`}
          title="YouTube video"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      {block.caption ? (
        <p className="mt-2 text-center text-xs text-muted">{block.caption}</p>
      ) : null}
    </section>
  );
}
