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
  /**
   * One bordered block: title “Token metadata”, banner + token uploads, then listing preview.
   * Use with `banner` + `logo` true.
   */
  tokenMetadataCard?: boolean;
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
  /** Shown in listing preview (create form). */
  previewTokenSymbol?: string;
  /** Shown in listing preview — launch / token display name. */
  previewDisplayName?: string;
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
  previewTokenSymbol,
  previewDisplayName,
}: Props) {
  const isCreate = variant === "create";
  const show = {
    intro: parts?.intro !== false,
    banner: parts?.banner !== false,
    logo: parts?.logo !== false,
    gallery: parts?.gallery !== false,
    social: parts?.social !== false,
    tokenMetadataCard: parts?.tokenMetadataCard === true,
  };
  const tokenLogoOnly = show.logo && !show.banner && !show.tokenMetadataCard;

  const bannerField = show.banner ? (
    <CollectionImageField
      name="bannerUrl"
      label={
        show.tokenMetadataCard
          ? "Listing banner"
          : "Banner (token & listing metadata)"
      }
      description={
        show.tokenMetadataCard
          ? "Wide strip (~3:1) for charts, explorers, and on-chain token metadata. Not Genesis Pass artwork — use NFT art below."
          : "Wide hero for /project, mint UI, and on-chain token / collection metadata (~3:1, center-cropped). Not your Genesis Pass image — use NFT art below for pass artwork."
      }
      aspectClass="aspect-[21/9] min-h-[140px]"
      value={bannerUrl}
      onUrlChange={onBannerUrlChange}
    />
  ) : null;

  const logoField = show.logo ? (
    <CollectionImageField
      name="logoUrl"
      label={
        show.tokenMetadataCard
          ? "Token icon"
          : tokenLogoOnly
            ? "Token logo (metadata)"
            : "Logo / avatar (metadata)"
      }
      description={
        show.tokenMetadataCard
          ? "Square icon beside your symbol on explorers and listings. Pass / trait art is uploaded separately as NFT art."
          : tokenLogoOnly
            ? "Square icon for SPL token and explorer metadata only. Genesis Pass artwork goes in step 02 under NFT art."
            : "Square mark for cards, mint UI, and token / collection metadata (center-cropped). Pass artwork belongs under NFT art when that section is shown."
      }
      aspectClass="aspect-square max-w-[280px]"
      value={logoUrl}
      onUrlChange={onLogoUrlChange}
    />
  ) : null;

  const mediaGrid = (show.banner || show.logo) && (
    <div className={`grid gap-8 ${show.banner && show.logo ? "lg:grid-cols-2" : ""}`}>
      {bannerField}
      {logoField}
    </div>
  );

  return (
    <div className="space-y-6">
      {show.intro && !show.tokenMetadataCard ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {introText ?? (
            <>
              Upload or paste <span className="text-white/85">https://</span> images. Files are optimized to stable URLs
              for Metaplex metadata and the site.
            </>
          )}
        </p>
      ) : null}

      {show.intro && show.tokenMetadataCard ? (
        <p className="text-[12px] leading-relaxed text-muted">{introText}</p>
      ) : null}

      {show.tokenMetadataCard ? (
        <div className="space-y-6 rounded-2xl border border-line bg-panel/20 p-5 sm:p-6">
          <div>
            <h3 className="text-sm font-semibold text-white">Token metadata</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Banner and icon are saved on your launch and in SPL-style token metadata (explorers, wallets, this site).
              Genesis Pass images are optional <span className="text-white/80">NFT art</span> in the next step.
            </p>
          </div>
          {mediaGrid}
          <TokenListingPreview
            bannerUrl={bannerUrl}
            logoUrl={logoUrl}
            symbol={previewTokenSymbol}
            name={previewDisplayName}
          />
        </div>
      ) : (
        mediaGrid
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

/** Rough DEX / pair listing layout: wide banner + overlapping token circle and labels. */
function TokenListingPreview({
  bannerUrl,
  logoUrl,
  symbol,
  name,
}: {
  bannerUrl: string;
  logoUrl: string;
  symbol?: string;
  name?: string;
}) {
  const sym = (symbol?.trim() || "TOKEN").toUpperCase().slice(0, 10);
  const title = name?.trim() || "Your launch name";
  const hasBanner = Boolean(bannerUrl?.trim());
  const hasLogo = Boolean(logoUrl?.trim());

  return (
    <div className="space-y-2 border-t border-line/60 pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Banner + token preview</p>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-black/50 shadow-inner">
        <div className="relative aspect-[21/9] min-h-[112px] w-full bg-black/40 sm:min-h-[128px]">
          {hasBanner ? (
            <img src={bannerUrl.trim()} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-muted">
              Banner shows here after upload
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-12 sm:pt-16" />
          <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-end gap-2.5 sm:bottom-3 sm:left-3 sm:gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/25 bg-ink shadow-lg ring-2 ring-black/40 sm:h-14 sm:w-14 ${
                hasLogo ? "" : "border-dashed"
              }`}
            >
              {hasLogo ? (
                <img src={logoUrl.trim()} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="px-1 text-center text-[8px] font-medium uppercase leading-tight text-muted">Icon</span>
              )}
            </div>
            <div className="min-w-0 pb-0.5">
              <p className="truncate text-sm font-semibold tracking-tight text-white drop-shadow-md">{title}</p>
              <p className="font-mono text-[11px] font-medium text-white/85 drop-shadow-md">{sym}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] leading-snug text-muted">
        Layout is approximate — charts, explorers, and wallets may crop differently.
      </p>
    </div>
  );
}
