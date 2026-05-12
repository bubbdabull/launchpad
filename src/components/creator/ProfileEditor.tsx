"use client";

import { useState } from "react";

import type { CreatorProfile } from "@/lib/creators/profiles";

type Props = {
  wallet: string;
  initial: CreatorProfile | null;
};

export function ProfileEditor({ wallet: _wallet, initial }: Props) {
  void _wallet;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [twitterHandle, setTwitterHandle] = useState(initial?.twitterHandle ?? "");
  const [discordHandle, setDiscordHandle] = useState(initial?.discordHandle ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch("/api/creator/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio,
          twitterHandle,
          discordHandle,
          websiteUrl,
          avatarUrl,
        }),
      });
      const j = (await r.json()) as { ok: boolean; message?: string };
      if (!r.ok || !j.ok) throw new Error(j.message ?? `HTTP ${r.status}`);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent">Owner controls</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Edit your profile</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted transition hover:text-white"
        >
          {open ? "Hide" : "Edit"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-4">
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={64}
              placeholder="Solana Cadets"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={1024}
              rows={3}
              placeholder="Short pitch — what do you build?"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Twitter handle (no @)">
              <input
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ""))}
                maxLength={64}
                placeholder="solanacadets"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </Field>
            <Field label="Discord">
              <input
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                maxLength={64}
                placeholder="cadets#0001"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </Field>
          </div>
          <Field label="Website">
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              maxLength={256}
              placeholder="https://yoursite.xyz"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <Field label="Avatar URL">
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={256}
              placeholder="https://.../avatar.png"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved ? <span className="text-xs text-emerald-300">Saved ✓</span> : null}
            {error ? <span className="text-xs text-rose-300">{error}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
