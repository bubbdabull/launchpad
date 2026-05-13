"use client";

import type { Dispatch, SetStateAction } from "react";

import type { PairedNftEntry, TokenMetadataProfile } from "@/lib/launch/token-metadata-profile";

import { CollectionImageField } from "./CollectionImageField";
import { LaunchGallerySection } from "./LaunchGallerySection";

type Variant = "create" | "manage";

type Props = {
  variant: Variant;
  galleryUrls: string[];
  setGalleryUrls: Dispatch<SetStateAction<string[]>>;
  bannerUrl: string;
  logoUrl: string;
  onBannerUrlChange: (v: string) => void;
  onLogoUrlChange: (v: string) => void;
  metaProfile: TokenMetadataProfile;
  onMetaProfileChange: (next: TokenMetadataProfile) => void;
  socialWebsite: string;
  socialTwitter: string;
  socialDiscord: string;
  socialTelegram: string;
  onSocialWebsite: (v: string) => void;
  onSocialTwitter: (v: string) => void;
  onSocialDiscord: (v: string) => void;
  onSocialTelegram: (v: string) => void;
};

export function LaunchMediaSection({
  variant,
  galleryUrls,
  setGalleryUrls,
  bannerUrl,
  logoUrl,
  onBannerUrlChange,
  onLogoUrlChange,
  metaProfile,
  onMetaProfileChange,
  socialWebsite,
  socialTwitter,
  socialDiscord,
  socialTelegram,
  onSocialWebsite,
  onSocialTwitter,
  onSocialDiscord,
  onSocialTelegram,
}: Props) {
  const isCreate = variant === "create";

  const pairedList: PairedNftEntry[] = metaProfile.pairedNfts?.length
    ? metaProfile.pairedNfts
    : [];

  function setPairedRows(rows: PairedNftEntry[]) {
    onMetaProfileChange({ ...metaProfile, pairedNfts: rows.length ? rows : undefined });
  }

  function updatePairedRow(i: number, patch: Partial<PairedNftEntry>) {
    const next = [...pairedList];
    next[i] = { ...next[i], ...patch };
    setPairedRows(next);
  }

  function addPairedRow() {
    setPairedRows([...pairedList, {}]);
  }

  function removePairedRow(i: number) {
    setPairedRows(pairedList.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] leading-relaxed text-muted">
        Upload or paste <span className="text-white/85">https://</span> images. Files are optimized to stable URLs for
        Metaplex metadata and the site.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <CollectionImageField
          name="bannerUrl"
          label="Banner"
          description="Wide hero (~3:1). Uploads are cropped and saved as 1920×640 PNG for consistent wallet + indexer previews."
          aspectClass="aspect-[21/9] min-h-[140px]"
          value={bannerUrl}
          onUrlChange={onBannerUrlChange}
        />
        <CollectionImageField
          name="logoUrl"
          label="Logo / avatar"
          description="Square mark for cards and DEX icons. Uploads are cropped and saved as 512×512 PNG."
          aspectClass="aspect-square max-w-[280px]"
          value={logoUrl}
          onUrlChange={onLogoUrlChange}
        />
      </div>

      <LaunchGallerySection galleryUrls={galleryUrls} setGalleryUrls={setGalleryUrls} />

      <div className="space-y-4 rounded-xl border border-line bg-ink/30 p-4">
        <div className="max-w-3xl space-y-2">
          <h4 className="text-sm font-semibold text-white">Rich metadata for explorers</h4>
          <p className="text-[11px] leading-relaxed text-muted">
            Optional sections below are appended after your main pitch inside the same{" "}
            <span className="text-white/85">description</span> field on-chain JSON — so DEXScreener, wallets, and
            indexers can show a fuller narrative without replacing your main description.
          </p>
          <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed text-muted marker:text-accent/80">
            <li>
              <span className="text-white/85">Story</span> — lore, world, why this drop exists.
            </li>
            <li>
              <span className="text-white/85">Roadmap</span> — phases, milestones, what ships after graduation.
            </li>
            <li>
              <span className="text-white/85">Community</span> — holder perks, events, how to plug in.
            </li>
            <li>
              GitHub / YouTube / TikTok merge into <span className="text-white/85">extensions</span> and{" "}
              <span className="text-white/85">links</span> next to Website · X · Discord · Telegram.
            </li>
          </ul>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <RichTextBlock
            label="Story"
            hint="Lore, world, why this drop exists…"
            value={metaProfile.story ?? ""}
            onChange={(v) => onMetaProfileChange({ ...metaProfile, story: v })}
          />
          <RichTextBlock
            label="Roadmap"
            hint="Phases, milestones, what ships after graduation…"
            value={metaProfile.roadmap ?? ""}
            onChange={(v) => onMetaProfileChange({ ...metaProfile, roadmap: v })}
          />
          <RichTextBlock
            label="Community"
            hint="Holder perks, events, how to plug in…"
            value={metaProfile.community ?? ""}
            onChange={(v) => onMetaProfileChange({ ...metaProfile, community: v })}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Linked NFT collections (optional)</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              One SPL token can umbrella several NFT mints (e.g. multiple passes). Add a row per collection; preview art
              is merged into <span className="text-white/80">properties.files</span>, mints get explorer links.
            </p>
          </div>
          {pairedList.length === 0 ? (
            <button
              type="button"
              onClick={addPairedRow}
              className="rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-white"
            >
              + Add linked NFT row
            </button>
          ) : (
            <div className="space-y-2">
              {pairedList.map((row, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-lg border border-line/80 bg-ink/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted">Label</span>
                    <input
                      value={row.name ?? ""}
                      onChange={(e) => updatePairedRow(i, { name: e.target.value })}
                      placeholder="e.g. Genesis Pass"
                      className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-white outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted">Mint (optional)</span>
                    <input
                      value={row.mint ?? ""}
                      onChange={(e) => updatePairedRow(i, { mint: e.target.value.trim() })}
                      placeholder="On-chain address when live"
                      className="w-full rounded-md border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-white outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted">Preview image https</span>
                    <input
                      value={row.image ?? ""}
                      onChange={(e) => updatePairedRow(i, { image: e.target.value.trim() })}
                      placeholder="https://…"
                      className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-white outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <div className="flex items-end justify-end sm:pb-0.5">
                    <button
                      type="button"
                      onClick={() => removePairedRow(i)}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-300/90 hover:bg-rose-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addPairedRow}
                disabled={pairedList.length >= 24}
                className="text-xs font-medium text-accent/90 hover:text-accent disabled:opacity-40"
              >
                + Add another
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">GitHub (https)</span>
            <input
              value={metaProfile.github ?? ""}
              onChange={(e) => onMetaProfileChange({ ...metaProfile, github: e.target.value })}
              placeholder="https://github.com/…"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">YouTube (https)</span>
            <input
              value={metaProfile.youtube ?? ""}
              onChange={(e) => onMetaProfileChange({ ...metaProfile, youtube: e.target.value })}
              placeholder="https://youtube.com/…"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">TikTok (https)</span>
            <input
              value={metaProfile.tiktok ?? ""}
              onChange={(e) => onMetaProfileChange({ ...metaProfile, tiktok: e.target.value })}
              placeholder="https://www.tiktok.com/…"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-panel/30 p-4">
        <div>
          <p className="text-sm font-medium text-white">
            {isCreate ? "Token & community links (optional)" : "Social links"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Saved on your launch row and echoed in SPL + NFT metadata (
            <code className="rounded bg-black/30 px-1 font-mono text-[10px]">extensions</code>
            ). Use full <span className="text-white/80">https://</span> links.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">Website</span>
            <input
              name="socialWebsite"
              value={socialWebsite}
              onChange={(e) => onSocialWebsite(e.target.value)}
              placeholder="https://yourproject.xyz"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">X (Twitter)</span>
            <input
              name="socialTwitter"
              value={socialTwitter}
              onChange={(e) => onSocialTwitter(e.target.value)}
              placeholder="https://x.com/…"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">Discord</span>
            <input
              name="socialDiscord"
              value={socialDiscord}
              onChange={(e) => onSocialDiscord(e.target.value)}
              placeholder="https://discord.gg/…"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">Telegram</span>
            <input
              name="socialTelegram"
              value={socialTelegram}
              onChange={(e) => onSocialTelegram(e.target.value)}
              placeholder="https://t.me/…"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RichTextBlock({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <p className="text-[10px] leading-snug text-muted/90">{hint}</p>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        className="min-h-[120px] w-full flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
      />
    </div>
  );
}
