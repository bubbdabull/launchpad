"use client";

import { useActionState, useMemo, useState } from "react";

import {
  launchManageInitialState,
  setLaunchPublished,
  updateLaunchSettings,
  type LaunchManageState,
} from "@/app/project/[slug]/manage/actions";
import { LaunchMediaSection } from "@/components/launchpad/LaunchMediaSection";
import { CreationProtocolLayersCard } from "@/components/protocol/CreationProtocolLayersCard";
import { serializeTokenMetadataProfile } from "@/lib/launch/token-metadata-profile";
import type { Collection } from "@/types/collection";

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "memes", label: "Memes" },
  { key: "art", label: "Art" },
  { key: "gaming", label: "Gaming" },
  { key: "music", label: "Music" },
  { key: "ai", label: "AI" },
];

export function LaunchSettingsForm({
  collection: c,
  isOnChain,
  isPublished,
}: {
  collection: Collection;
  isOnChain: boolean;
  isPublished: boolean;
}) {
  const [state, action, pending] = useActionState<LaunchManageState, FormData>(
    updateLaunchSettings,
    launchManageInitialState,
  );
  const [pubState, pubAction, pubPending] = useActionState<LaunchManageState, FormData>(
    setLaunchPublished,
    launchManageInitialState,
  );

  const [name, setName] = useState(c.name);
  const [tagline, setTagline] = useState(c.tagline);
  const [description, setDescription] = useState(c.description);
  const [bannerUrl, setBannerUrl] = useState(c.bannerUrl);
  const [logoUrl, setLogoUrl] = useState(c.logoUrl);
  const [phase, setPhase] = useState(c.phase);
  const [category, setCategory] = useState(c.category ?? "");
  const [utilities, setUtilities] = useState((c.utilities ?? []).join(", "));
  const [holderRewardPct, setHolderRewardPct] = useState(
    String(c.holderRewardPct ?? 50),
  );
  const [tokenHolderRewardPct, setTokenHolderRewardPct] = useState(
    String(c.tokenHolderRewardPct ?? 0),
  );

  const [galleryUrls, setGalleryUrls] = useState<string[]>(c.nftGalleryUrls ?? []);
  const [socialWebsite, setSocialWebsite] = useState(c.tokenSocialLinks?.website ?? "");
  const [socialTwitter, setSocialTwitter] = useState(c.tokenSocialLinks?.twitter ?? "");
  const [socialDiscord, setSocialDiscord] = useState(c.tokenSocialLinks?.discord ?? "");
  const [socialTelegram, setSocialTelegram] = useState(c.tokenSocialLinks?.telegram ?? "");
  const [socialTiktok, setSocialTiktok] = useState(
    c.tokenSocialLinks?.tiktok ?? c.tokenMetadataProfile?.tiktok ?? "",
  );

  const tokenMetadataProfileHidden = useMemo(() => {
    const p = c.tokenMetadataProfile ?? {};
    return JSON.stringify(
      serializeTokenMetadataProfile({
        posterImageUrl: p.posterImageUrl,
        animationUrl: p.animationUrl,
      }),
    );
  }, [c.tokenMetadataProfile?.posterImageUrl, c.tokenMetadataProfile?.animationUrl]);
  const [quoteAsset, setQuoteAsset] = useState<"SOL" | "USDC">(c.quoteAsset === "USDC" ? "USDC" : "SOL");
  const [sliceBPct, setSliceBPct] = useState(c.sliceBPct ?? 0);
  const [sliceBCreatorSharePct, setSliceBCreatorSharePct] = useState(c.sliceBCreatorSharePct ?? 50);

  const sliceAPct = 100 - sliceBPct;
  const sliceBWhole = Math.floor((1_000_000_000 * sliceBPct) / 100);
  const sliceAWhole = 1_000_000_000 - sliceBWhole;

  return (
    <div className="space-y-8">
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

      <form action={action} className="space-y-8 rounded-2xl border border-line bg-panel/40 p-6">
        <input type="hidden" name="slug" value={c.slug} />
        <input type="hidden" name="nftGalleryUrls" value={JSON.stringify(galleryUrls)} />
        <input type="hidden" name="tokenMetadataProfile" value={tokenMetadataProfileHidden} />

        <section className="space-y-5">
          <SectionHeader
            title="Public-facing details"
            sub="Shown on the home grid, project page, and trade page."
          />
          <CreationProtocolLayersCard snapshot={c.creationProtocolLayers ?? null} variant="full" preSubmitFooter={false} />
          <Field label="Name" maxLength={96}>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <Field label="Tagline" maxLength={200}>
            <input
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <Field label="Description" maxLength={4000}>
            <textarea
              name="description"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
          <LaunchMediaSection
            variant="manage"
            parts={{ intro: false, tokenMetadataCard: true }}
            galleryUrls={galleryUrls}
            setGalleryUrls={setGalleryUrls}
            bannerUrl={bannerUrl}
            logoUrl={logoUrl}
            onBannerUrlChange={setBannerUrl}
            onLogoUrlChange={setLogoUrl}
            previewTokenSymbol={c.tokenSymbol ?? ""}
            previewDisplayName={name}
            socialWebsite={socialWebsite}
            socialTwitter={socialTwitter}
            socialDiscord={socialDiscord}
            socialTelegram={socialTelegram}
            socialTiktok={socialTiktok}
            onSocialWebsite={setSocialWebsite}
            onSocialTwitter={setSocialTwitter}
            onSocialDiscord={setSocialDiscord}
            onSocialTelegram={setSocialTelegram}
            onSocialTiktok={setSocialTiktok}
          />
        </section>

        <section className="space-y-5">
          <SectionHeader
            title="Discovery + framing"
            sub="Helps buyers find your launch and understand the offer."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phase label">
              <input
                name="phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="Public mint"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </Field>
            <Field label="Category">
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              >
                <option value="">— uncategorized —</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Utilities (comma separated)"
            sub="Up to 12. Renders as chips on cards + project page."
          >
            <input
              name="utilities"
              value={utilities}
              onChange={(e) => setUtilities(e.target.value)}
              placeholder="Discord access, Pre-mint allowlist, Merch drops"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            />
          </Field>
        </section>

        <section className="space-y-5">
          <SectionHeader
            title="Holder rewards"
            sub="We save these with your launch. Once you're live, Solana runs the real rules."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Trading-fee % to holders"
              sub="Share of your trading-fee slice that goes to pass holders."
            >
              <input
                name="holderRewardPct"
                type="number"
                min={0}
                max={100}
                value={holderRewardPct}
                onChange={(e) => setHolderRewardPct(e.target.value)}
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </Field>
            <Field
              label="Vested-token % to holders"
              sub="How much of unlocked tokens you want to point at pass holders (saved here for later setup)."
            >
              <input
                name="tokenHolderRewardPct"
                type="number"
                min={0}
                max={100}
                value={tokenHolderRewardPct}
                onChange={(e) => setTokenHolderRewardPct(e.target.value)}
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </Field>
          </div>
        </section>

        {!isOnChain && !c.alphaVault ? (
          <section className="space-y-5">
            <SectionHeader
              title="Pre-deploy details"
              sub="Editable until you deploy on-chain. After the Alpha Vault is linked, the symbol locks."
            />
            <Field label="Token symbol (uppercase, 2–10 chars)">
              <input
                name="tokenSymbol"
                defaultValue={c.tokenSymbol ?? ""}
                pattern="[A-Z0-9]{2,10}"
                placeholder="WIRE"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              />
            </Field>
            <Field
              label="Primary-sale quote"
              sub="Stored with the launch. On-chain mint wiring still assumes SOL until USDC vault support ships."
            >
              <select
                name="quoteAsset"
                value={quoteAsset}
                onChange={(e) => setQuoteAsset(e.target.value === "USDC" ? "USDC" : "SOL")}
                className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
              >
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </select>
            </Field>
            <div className="space-y-4 rounded-xl border border-line/60 bg-ink/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted">1B token split (pre-deploy)</p>
              <input type="hidden" name="sliceBPct" value={String(sliceBPct)} />
              <input type="hidden" name="sliceBCreatorSharePct" value={String(sliceBCreatorSharePct)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slice B reserve (% of 1B)">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={sliceBPct}
                      onChange={(e) => setSliceBPct(Number(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <span className="w-10 text-right text-sm text-white">{sliceBPct}%</span>
                  </div>
                </Field>
                <Field label="Your share of Slice B">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={sliceBCreatorSharePct}
                      onChange={(e) => setSliceBCreatorSharePct(Number(e.target.value))}
                      disabled={sliceBPct === 0}
                      className="flex-1 accent-accent disabled:opacity-40"
                    />
                    <span className="w-10 text-right text-sm text-white">{sliceBCreatorSharePct}%</span>
                  </div>
                </Field>
              </div>
              <p className="text-[11px] text-muted">
                Slice A ≈ {sliceAWhole.toLocaleString()} whole tokens ({sliceAPct}%) · Slice B reserve ≈{" "}
                {sliceBWhole.toLocaleString()} ({sliceBPct}%) — frozen once the Alpha Vault pubkey is stored.
              </p>
            </div>
          </section>
        ) : !isOnChain && c.alphaVault ? (
          <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/90">Alpha Vault linked</p>
            <p className="text-xs text-amber-100/90">
              Token symbol is locked because your launch record already has an Alpha Vault pubkey. Finish Core
              collection deploy to move fully on-chain; supply and mint price stay fixed from create.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              <li>
                Quote · <span className="text-white/80">{c.quoteAsset === "USDC" ? "USDC" : "SOL"}</span>
              </li>
              <li>
                Symbol · <span className="text-white/80">{c.tokenSymbol ?? "—"}</span>
              </li>
              <li>
                Slice B · <span className="text-white/80">{c.sliceBPct ?? 0}%</span> of 1B · creator share of Slice B{" "}
                <span className="text-white/80">{c.sliceBCreatorSharePct ?? 50}%</span>
              </li>
            </ul>
          </section>
        ) : (
          <section className="space-y-3 rounded-xl border border-line/60 bg-ink/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted">Locked on-chain</p>
            <ul className="space-y-1 text-xs text-muted">
              <li>
                Quote · <span className="text-white/80">{c.quoteAsset === "USDC" ? "USDC" : "SOL"}</span>
              </li>
              <li>
                Token symbol · <span className="text-white/80">{c.tokenSymbol ?? "—"}</span>
              </li>
              <li>
                Slice B · <span className="text-white/80">{c.sliceBPct ?? 0}%</span> of 1B · creator share of Slice B{" "}
                <span className="text-white/80">{c.sliceBCreatorSharePct ?? 50}%</span>
              </li>
              <li>
                Supply ·{" "}
                <span className="text-white/80">{c.supply.toLocaleString()}</span>
              </li>
              <li>
                Mint price · <span className="text-white/80">{c.priceLabel}</span>
              </li>
              {(c.creatorVestingSupplyPct ?? 0) > 0 ? (
                <li>
                  Vesting ·{" "}
                  <span className="text-white/80">
                    {c.creatorVestingSupplyPct}% over {c.creatorVestingPeriodMonths}mo
                  </span>
                </li>
              ) : null}
            </ul>
          </section>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <form
        action={pubAction}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/40 p-5"
      >
        <input type="hidden" name="slug" value={c.slug} />
        <input type="hidden" name="isPublished" value={isPublished ? "false" : "true"} />
        <div>
          <p className="text-sm font-medium text-white">
            {isPublished ? "Hide this launch" : "Publish this launch"}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {isPublished
              ? "Removes it from /launches and the discovery feed. Direct links still work."
              : "Adds it back to the public grid + discovery feed."}
          </p>
          {pubState.message ? (
            <p
              className={`mt-2 text-xs ${
                pubState.ok ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {pubState.message}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pubPending}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            isPublished
              ? "border border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
              : "bg-accent text-ink hover:brightness-110"
          }`}
        >
          {pubPending ? "…" : isPublished ? "Hide" : "Publish"}
        </button>
      </form>
    </div>
  );
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
  maxLength,
  children,
}: {
  label: string;
  sub?: string;
  maxLength?: number;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
        {maxLength ? (
          <span className="text-[10px] text-muted/70">max {maxLength}</span>
        ) : null}
      </div>
      {children}
      {sub ? <p className="text-[11px] text-muted">{sub}</p> : null}
    </label>
  );
}
