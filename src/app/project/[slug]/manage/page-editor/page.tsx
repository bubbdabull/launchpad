import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProjectPageEditor } from "@/components/launch/ProjectPageEditor";
import { getWalletSession } from "@/lib/auth/session";
import { getCollectionBySlug } from "@/lib/data/launchpad";
import { isCollectionCreator } from "@/lib/data/store-admin";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function PageEditorRoute({ params }: PageProps) {
  const { slug } = await params;

  const session = await getWalletSession();
  if (!session) redirect(`/launch/${slug}`);

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) redirect(`/launch/${slug}`);

  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="space-y-2">
        <Link
          href={`/project/${slug}/manage`}
          className="text-[11px] uppercase tracking-wider text-muted hover:text-white"
        >
          ← Back to launch settings
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">
          Project page editor
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Customize {c.name}&rsquo;s project page
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Add story blocks, FAQ, roadmap, image galleries, and YouTube embeds. Pick a hero layout
          and accent color. The default banner + description + stats grid still renders unless you
          choose to hide them.
        </p>
        <div className="pt-2">
          <Link
            href={`/project/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
          >
            View project page →
          </Link>
        </div>
      </header>

      <ProjectPageEditor collection={c} />
    </div>
  );
}
