"use client";

import type { Dispatch, SetStateAction } from "react";

import { CollectionImageField } from "./CollectionImageField";
import { LaunchGallerySection } from "./LaunchGallerySection";

type Variant = "create" | "manage";

/** Omit keys or set to `false` to hide blocks (defaults: all visible). */
export type LaunchMediaSectionParts = {
  intro?: boolean;
  banner?: boolean;
  logo?: boolean;
  gallery?: boolean;
  social?: boolean;
};

type Props = {
  variant: Variant;
  galleryUrls: string[];
  setGalleryUrls: Dispatch<SetStateAction<string[]>>;
  bannerUrl: string;
  logoUrl: string;
  onBannerUrlChange: (v: string) => void;
  onLogoUrlChange: (v: string) => void;
  socialWebsite: string;
  socialTwitter: string;
  socialDiscord: string;
  socialTelegram: string;
  socialTiktok: string;
  onSocialWebsite: (v: string) => void;
  onSocialTwitter: (v: string) => void;
  onSocialDiscord: (v: string) => void;
  onSocialTelegram: (v: string) => void;
  onSocialTiktok: (v: string) => void;
  parts?: LaunchMediaSectionParts;
  /** When `parts.intro` is not false, replaces the default https upload blurb. */
  introText?: string;
};

export function LaunchMediaSection({
  variant,
  galleryUrls,
  setGalleryUrls,
  bannerUrl,
  logoUrl,
  onBannerUrlChange,
  onLogoUrlChange,
  socialWebsite,
  socialTwitter,
  socialDiscord,
  socialTelegram,
  socialTiktok,
  onSocialWebsite,
  onSocialTwitter,
  onSocialDiscord,
  onSocialTelegram,
  onSocialTiktok,
  parts,
  introText,
}: Props) {
  const isCreate = variant === "create";
  const show = {
    intro: parts?.intro !== false,
    banner: parts?.banner !== false,
    logo: parts?.logo !== false,
    gallery: parts?.gallery !== false,
    social: parts?.social !== false,
  };
  const tokenLogoOnly = show.logo && !show.banner;

  return (
    <div className="space-y-6">
      {show.intro ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {introText ?? (
            <>
              Upload or paste <span className="text-white/85">https://</span> images. Files are optimized to stable URLs
              for Metaplex metadata and the site.
            </>
          )}
        </p>
      ) : null}

      {(show.banner || show.logo) && (
        <div className={`grid gap-8 ${show.banner && show.logo ? "lg:grid-cols-2" : ""}`}>
          {show.banner ? (
            <CollectionImageField
              name="bannerUrl"
              label="Banner (token & listing metadata)"
              description="Wide hero for /project, mint UI, and on-chain token / collection metadata (~3:1, center-cropped). Not your Genesis Pass image — use NFT art below for pass artwork."
              aspectClass="aspect-[21/9] min-h-[140px]"
              value={bannerUrl}
              onUrlChange={onBannerUrlChange}
            />
          ) : null}
          {show.logo ? (
            <CollectionImageField
              name="logoUrl"
              label={tokenLogoOnly ? "Token logo (metadata)" : "Logo / avatar (metadata)"}
              description={
                tokenLogoOnly
                  ? "Square icon for the SPL token in wallets, explorers, and DEX metadata. Pass / trait artwork goes under NFT art in the next step."
                  : "Square mark for cards, mint UI, and token / collection metadata (center-cropped). Pass artwork belongs under NFT art when that section is shown."
              }
              aspectClass="aspect-square max-w-[280px]"
              value={logoUrl}
              onUrlChange={onLogoUrlChange}
            />
          ) : null}
        </div>
      )}

      {show.gallery ? <LaunchGallerySection galleryUrls={galleryUrls} setGalleryUrls={setGalleryUrls} /> : null}

      {show.social ? (
        <div className="space-y-3 rounded-xl border border-line bg-panel/30 p-4">
          <div>
            <p className="text-sm font-medium text-white">
              {isCreate ? "Links for wallets & explorers (optional)" : "Links for wallets & explorers"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Saved on your launch and merged into token metadata (
              <code className="rounded bg-black/30 px-1 font-mono text-[10px]">extensions</code>,{" "}
              <code className="rounded bg-black/30 px-1 font-mono text-[10px]">external_url</code>, top-level fields).
              Use full <span className="text-white/80">https://</span> URLs.
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
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted">TikTok (optional)</span>
              <input
                name="socialTiktok"
                value={socialTiktok}
                onChange={(e) => onSocialTiktok(e.target.value)}
                placeholder="https://www.tiktok.com/…"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
