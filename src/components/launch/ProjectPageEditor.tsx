"use client";

import { useActionState, useState } from "react";

import {
  launchManageInitialState,
  updateProjectPage,
  type LaunchManageState,
} from "@/app/project/[slug]/manage/actions";
import { isValidAccentColor, type ProjectPageDoc } from "@/lib/launch/project-page";
import type { Collection } from "@/types/collection";

import { ProjectPageFormFields } from "./ProjectPageFormFields";

/**
 * Whole-document editor for a launch's project page.
 *
 * State model: the entire ProjectPageDoc + theme settings live in
 * component state and are submitted as a single JSON blob. The server
 * sanitizes everything on save, so this client doesn't need to be
 * defensive — it just needs to be productive.
 */
export function ProjectPageEditor({ collection: c }: { collection: Collection }) {
  const initialDoc: ProjectPageDoc = c.projectPage ?? {
    blocks: [],
    hideDefaultDescription: false,
    hideDefaultStats: false,
  };

  const [doc, setDoc] = useState<ProjectPageDoc>(initialDoc);
  const [accentColor, setAccentColor] = useState<string>(c.accentColor ?? "");
  const [heroLayout, setHeroLayout] = useState<string>(c.heroLayout ?? "classic");
  const [projectHeadline, setProjectHeadline] = useState<string>(c.projectHeadline ?? "");
  const [projectSubhead, setProjectSubhead] = useState<string>(c.projectSubhead ?? "");

  const [state, formAction, pending] = useActionState<LaunchManageState, FormData>(
    updateProjectPage,
    launchManageInitialState,
  );

  const accentValid = !accentColor || isValidAccentColor(accentColor);

  return (
    <form
      action={formAction}
      className="space-y-8"
      onSubmit={(e) => {
        if (!accentValid) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="slug" value={c.slug} />
      <input type="hidden" name="payload" value={JSON.stringify(doc)} />
      <input type="hidden" name="accentColor" value={accentColor} />
      <input type="hidden" name="heroLayout" value={heroLayout} />
      <input type="hidden" name="projectHeadline" value={projectHeadline} />
      <input type="hidden" name="projectSubhead" value={projectSubhead} />

      {state.message ? (
        <p
          className={`rounded-xl border p-3 text-sm ${
            state.ok
              ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"
              : "border-rose-400/30 bg-rose-400/5 text-rose-200"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <ProjectPageFormFields
        doc={doc}
        setDoc={setDoc}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        heroLayout={heroLayout}
        setHeroLayout={setHeroLayout}
        projectHeadline={projectHeadline}
        setProjectHeadline={setProjectHeadline}
        projectSubhead={projectSubhead}
        setProjectSubhead={setProjectSubhead}
        namePlaceholder={c.name}
        taglinePlaceholder={c.tagline}
        heroLayoutRadioName="manageHeroLayout"
      />

      <div className="sticky bottom-4 z-20 flex justify-end">
        <button
          type="submit"
          disabled={pending || !accentValid}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink shadow-card transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save project page"}
        </button>
      </div>
    </form>
  );
}
