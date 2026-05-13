"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createDraftCollection, type CreateLaunchState } from "@/app/create/actions";
import { CreationProtocolLayersCard } from "@/components/protocol/CreationProtocolLayersCard";
import {
  explainLaunchEconomicsError,
  LAUNCH_ECONOMICS_POLICY,
  validateLaunchEconomicsInputs,
} from "@/lib/launch/launch-economics-policy";
import { genesisMintTaxTotalLamports, GENESIS_MINT_TAX_BPS, mintPriceSolToLamports } from "@/lib/launch/genesis-mint-tax";
import {
  creatorLegOfTradeApproxBps,
  platformShareOfTradeApproxBps,
  splitCreatorLegForDisplay,
  tradingTaxPctLabel,
} from "@/lib/launch/trading-tax-protocol";
import { HERO_LAYOUTS, isValidAccentColor } from "@/lib/launch/project-page";

import { GenesisGenerativeFields } from "./GenesisGenerativeFields";
import { LaunchMediaSection } from "./LaunchMediaSection";

const initialState: CreateLaunchState = { ok: false };

function readBigIntEnv(value: string | undefined, fallback: bigint): bigint {
  const raw = value?.trim();
  if (raw) {
    try {
      const v = BigInt(raw);
      if (v >= BigInt(0)) return v;
    } catch {
      /* fall through */
    }
  }
  return fallback;
}

const PLATFORM_DEPLOY_FEE_LAMPORTS = readBigIntEnv(
  process.env.NEXT_PUBLIC_PLATFORM_DEPLOY_FEE_LAMPORTS,
  BigInt(200_000_000),
);

const GENESIS_MINT_TAX_PCT_LABEL = `${Number(GENESIS_MINT_TAX_BPS) / 100}%`;

function readPctEnv(value: string | undefined, fallback: number): number {
  const raw = Number(value?.trim());
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return fallback;
  return Math.round(raw);
}

const DEFAULT_HOLDER_REWARD_PCT = readPctEnv(
  process.env.NEXT_PUBLIC_PLATFORM_TRADING_DEFAULT_HOLDER_REWARD_PCT,
  50,
);

function bpsToPctLabel(bps: number, fractionDigits = 2): string {
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}

function formatSol(lamports: bigint): string {
  return `${(Number(lamports) / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} SOL`;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#121214] to-[#0c0c0e] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
      <header className="mb-6 border-b border-white/[0.06] pb-5">
        <div className="flex flex-wrap items-center gap-3 gap-y-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] font-mono text-xs font-bold tracking-tight text-accent">
            {step}
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-white sm:text-xl">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-white/90">
      {children}
    </label>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/50 p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-white">{value}</p>
      {sub ? <p className="mt-1 text-[11px] leading-relaxed text-muted">{sub}</p> : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-muted/60";

const SLUG_FIELD_RE = /^[a-z0-9-]{3,64}$/;
const TOKEN_SYMBOL_FIELD_RE = /^[A-Z0-9]{2,10}$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Empty project page doc — public /project page uses headline, art, mint stats (no block builder). */
const EMPTY_PROJECT_PAGE_JSON = JSON.stringify({
  blocks: [],
  hideDefaultDescription: false,
  hideDefaultStats: false,
});

export function CreateLaunchForm() {
  const [state, action, pending] = useActionState(createDraftCollection, initialState);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [utilities, setUtilities] = useState("");
  const [supplyInput, setSupplyInput] = useState("1000");
  const [priceInput, setPriceInput] = useState("0.2");
  const [quoteAsset, setQuoteAsset] = useState<"SOL" | "USDC">("SOL");
  const [priceLabel, setPriceLabel] = useState("");
  const [phase, setPhase] = useState("");
  const [creatorTreasury, setCreatorTreasury] = useState("");
  const [holderRewardPct, setHolderRewardPct] = useState<number>(DEFAULT_HOLDER_REWARD_PCT);
  const creatorSelfPct = 100 - holderRewardPct;

  const [vestingPct, setVestingPct] = useState(0);
  const [vestingCliff, setVestingCliff] = useState(0);
  const [vestingPeriod, setVestingPeriod] = useState(12);
  const [tokenHolderRewardPct, setTokenHolderRewardPct] = useState(0);
  const [sliceBPct, setSliceBPct] = useState(0);
  const [sliceBCreatorSharePct, setSliceBCreatorSharePct] = useState(50);

  const [creatorRewardVestingSlots, setCreatorRewardVestingSlots] = useState("216000");
  const [creatorRewardDelaySlots, setCreatorRewardDelaySlots] = useState("0");
  const [creatorRewardCooldownSlots, setCreatorRewardCooldownSlots] = useState("0");
  const [creatorRewardMaxClaimPerEpoch, setCreatorRewardMaxClaimPerEpoch] = useState("");
  const [creatorRewardIncentiveSharePct, setCreatorRewardIncentiveSharePct] = useState(0);
  const [creatorRewardImmutable, setCreatorRewardImmutable] = useState(false);

  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialDiscord, setSocialDiscord] = useState("");
  const [socialTelegram, setSocialTelegram] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");

  const [projectAccentColor, setProjectAccentColor] = useState("");
  const [projectHeroLayout, setProjectHeroLayout] = useState<string>("classic");
  const [projectPageHeadline, setProjectPageHeadline] = useState("");
  const [projectPageSubhead, setProjectPageSubhead] = useState("");

  const [submitHint, setSubmitHint] = useState<string | null>(null);

  const TOTAL_TOKEN_SUPPLY = 1_000_000_000;
  const sliceAPct = 100 - sliceBPct;
  const sliceBWholeTokens = Math.floor((TOTAL_TOKEN_SUPPLY * sliceBPct) / 100);
  const sliceBCreatorWhole = Math.floor((sliceBWholeTokens * sliceBCreatorSharePct) / 100);
  const sliceBHolderWhole = sliceBWholeTokens - sliceBCreatorWhole;
  const sliceAWholeTokens = TOTAL_TOKEN_SUPPLY - sliceBWholeTokens;
  const lockedTokens = Math.floor((TOTAL_TOKEN_SUPPLY * vestingPct) / 100);
  const tokensPerMonth = vestingPct > 0 && vestingPeriod > 0 ? Math.floor(lockedTokens / vestingPeriod) : 0;
  const tokensToCreator = Math.floor((lockedTokens * (100 - tokenHolderRewardPct)) / 100);
  const tokensToHolders = lockedTokens - tokensToCreator;

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  const { supplyNum, priceNum, totalQuote, valid, policyError, exampleGenesisTaxLamports } = useMemo(() => {
    const s = Number(supplyInput);
    const p = Number(priceInput);
    const numbersOk = Number.isFinite(s) && Number.isFinite(p);
    const err = numbersOk ? validateLaunchEconomicsInputs({ supply: s, mintPriceSol: p }) : null;
    const v = numbersOk && !err;
    const mpLamports = v ? mintPriceSolToLamports(p) : 0n;
    const exampleGenesisTaxLamports = genesisMintTaxTotalLamports(mpLamports);
    return {
      supplyNum: numbersOk ? s : NaN,
      priceNum: numbersOk ? p : NaN,
      totalQuote: numbersOk ? s * p : NaN,
      valid: v,
      policyError: err,
      exampleGenesisTaxLamports,
    };
  }, [supplyInput, priceInput]);

  const quoteLabel = quoteAsset === "USDC" ? "USDC" : "SOL";

  const tradingSplitDisplay = useMemo(() => splitCreatorLegForDisplay(holderRewardPct), [holderRewardPct]);

  const publishFormValid = useMemo(() => {
    if (!valid) return false;
    const slugNorm = slug.trim().toLowerCase();
    if (!SLUG_FIELD_RE.test(slugNorm)) return false;
    if (!TOKEN_SYMBOL_FIELD_RE.test(tokenSymbol.trim().toUpperCase())) return false;
    return true;
  }, [valid, slug, tokenSymbol]);

  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message && !state.ok && footerRef.current) {
      footerRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [state.message, state.ok]);

  return (
    <form
      action={action}
      className="space-y-8"
      onSubmit={(e) => {
        if (!valid) {
          e.preventDefault();
          setSubmitHint(
            policyError
              ? explainLaunchEconomicsError(policyError)
              : "Enter a valid NFT supply and mint price (see step 04 bounds).",
          );
          return;
        }
        const slugNorm = slug.trim().toLowerCase();
        if (!SLUG_FIELD_RE.test(slugNorm)) {
          e.preventDefault();
          setSubmitHint("Slug must be 3–64 characters: lowercase letters, numbers, and hyphens only.");
          return;
        }
        const sym = tokenSymbol.trim().toUpperCase();
        if (!TOKEN_SYMBOL_FIELD_RE.test(sym)) {
          e.preventDefault();
          setSubmitHint("Token symbol must be 2–10 letters or numbers (A–Z / 0–9).");
          return;
        }
        const b = bannerUrl.trim();
        const l = logoUrl.trim();
        if (!b || !l) {
          e.preventDefault();
          setSubmitHint(
            !l && !b
              ? "Add token icon and listing banner in step 01 (Token metadata) — upload or paste an https:// link for each."
              : !l
                ? "Add token icon in step 01 (Token metadata)."
                : "Add listing banner in step 01 (Token metadata).",
          );
          return;
        }
        if (!/^https:\/\//i.test(b) || !/^https:\/\//i.test(l)) {
          e.preventDefault();
          setSubmitHint(
            !/^https:\/\//i.test(l)
              ? "Token icon in step 01 (Token metadata) must be a full https:// URL."
              : "Listing banner in step 01 (Token metadata) must be a full https:// URL.",
          );
          return;
        }
        const ac = projectAccentColor.trim();
        if (ac && !isValidAccentColor(ac)) {
          e.preventDefault();
          setSubmitHint("Use a valid accent hex (#RGB or #RRGGBB) or clear the field.");
          return;
        }
        setSubmitHint(null);
      }}
    >
      <input type="hidden" name="projectPagePayload" value={EMPTY_PROJECT_PAGE_JSON} />

      <Section
        step="00"
        title="How this works"
        subtitle="This form saves your launch listing. Mint limits, pricing, and trading behavior are enforced on-chain when you deploy from your launch’s trade page—not by this form alone."
      >
        <CreationProtocolLayersCard />
      </Section>

      <Section
        step="01"
        title="Launch identity, listing copy & token metadata"
        subtitle="Names, SPL symbol, listing copy, utilities, then token metadata (banner + icon). Optional Genesis art and traits in step 02."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Launch name</FieldLabel>
            <input
              name="name"
              required
              placeholder="e.g. Bonk Cadets"
              className={inputClass}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>URL slug</FieldLabel>
            <input
              name="slug"
              required
              placeholder="bonk-cadets"
              className={inputClass}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
            <p className="text-[11px] text-muted">Paths: /mint/&lt;slug&gt;, /launch/&lt;slug&gt;, /project/&lt;slug&gt;</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Token name</FieldLabel>
            <input
              name="tokenName"
              required
              placeholder="Matches launch or token brand"
              className={inputClass}
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Token symbol</FieldLabel>
            <input
              name="tokenSymbol"
              required
              placeholder="CADET"
              maxLength={10}
              className={`${inputClass} uppercase`}
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
            />
            <p className="text-[11px] text-muted">2–10 characters A–Z / 0–9 (deploy locks this on-chain).</p>
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel>Tagline</FieldLabel>
          <input
            name="tagline"
            placeholder="One line for cards and headers"
            className={inputClass}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Description</FieldLabel>
          <textarea
            name="description"
            required
            rows={5}
            placeholder="What collectors get, timeline, and how Genesis Pass + token work together."
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Utilities (comma-separated)</FieldLabel>
          <input
            name="utilities"
            placeholder="Genesis Pass, Fee share"
            className={inputClass}
            value={utilities}
            onChange={(e) => setUtilities(e.target.value)}
          />
        </div>

        <p className="text-[12px] leading-relaxed text-muted">
          <span className="font-medium text-amber-200/90">Required before publish:</span>{" "}
          <span className="font-medium text-white/90">Token metadata</span> below — upload or paste https for both the
          listing banner and the token icon (not Genesis Pass art; that is step 02, NFT art).
        </p>
        <LaunchMediaSection
          variant="create"
          parts={{
            intro: false,
            tokenMetadataCard: true,
            banner: true,
            logo: true,
            gallery: false,
            social: true,
          }}
          galleryUrls={galleryUrls}
          setGalleryUrls={setGalleryUrls}
          bannerUrl={bannerUrl}
          logoUrl={logoUrl}
          onBannerUrlChange={setBannerUrl}
          onLogoUrlChange={setLogoUrl}
          previewTokenSymbol={tokenSymbol}
          previewDisplayName={tokenName.trim() || name.trim() || undefined}
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
        <input type="hidden" name="tokenMetadataProfile" value="{}" />
      </Section>

      <Section
        step="02"
        title="NFT collection, art & variations"
        subtitle="Optional Genesis Pass art, trait-config URL, reveal timing, and rarity links."
      >
        <p className="text-[11px] leading-relaxed text-muted">
          <span className="font-medium text-amber-200/90">Optional</span> NFT art and trait links here. Token banner and
          icon live in step 01. Mints and on-chain metadata updates use the Trade page and your wallet.
        </p>
        <LaunchMediaSection
          variant="create"
          introText="These uploads are for Genesis Pass or collection artwork only. Your DEXScreener-style banner and token icon live under Token metadata in step 01."
          parts={{
            intro: true,
            banner: false,
            gallery: true,
            logo: false,
            social: false,
            tokenMetadataCard: false,
          }}
          galleryUrls={galleryUrls}
          setGalleryUrls={setGalleryUrls}
          bannerUrl={bannerUrl}
          logoUrl={logoUrl}
          onBannerUrlChange={setBannerUrl}
          onLogoUrlChange={setLogoUrl}
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
        <input type="hidden" name="nftGalleryUrls" value={JSON.stringify(galleryUrls)} />

        <GenesisGenerativeFields />
      </Section>

      <Section
        step="03"
        title="Project page presentation"
        subtitle="Headline and hero for /project/&lt;slug&gt;. No block builder — keep it clean for art + mint progress."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Headline</FieldLabel>
            <input
              name="projectHeadline"
              placeholder="Defaults to launch name if empty"
              className={inputClass}
              value={projectPageHeadline}
              onChange={(e) => setProjectPageHeadline(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Subhead</FieldLabel>
            <input
              name="projectSubhead"
              placeholder="Defaults to tagline if empty"
              className={inputClass}
              value={projectPageSubhead}
              onChange={(e) => setProjectPageSubhead(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="accent">Accent (optional hex)</FieldLabel>
            <input
              id="accent"
              name="accentColor"
              placeholder="#7CFFB2"
              className={`${inputClass} font-mono`}
              value={projectAccentColor}
              onChange={(e) => setProjectAccentColor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="hero">Hero layout</FieldLabel>
            <select
              id="hero"
              name="heroLayout"
              className={inputClass}
              value={projectHeroLayout}
              onChange={(e) => setProjectHeroLayout(e.target.value)}
            >
              {HERO_LAYOUTS.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.label} — {h.sub}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section
        step="04"
        title="Genesis Pass supply & mint price"
        subtitle="Maps to collection row now; deploy builds initialize_launch with genesis_supply and expected_quote_per_mint (SOL lamports on-chain today)."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel>NFT supply (genesis_supply)</FieldLabel>
            <input
              name="supply"
              value={supplyInput}
              onChange={(e) => setSupplyInput(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
            <p className="text-[11px] text-muted">
              {LAUNCH_ECONOMICS_POLICY.MIN_SUPPLY.toLocaleString()}–{LAUNCH_ECONOMICS_POLICY.MAX_SUPPLY.toLocaleString()}{" "}
              passes
            </p>
          </div>
          <div className="space-y-2">
            <FieldLabel>Quote asset (stored)</FieldLabel>
            <select
              name="quoteAsset"
              value={quoteAsset}
              onChange={(e) => setQuoteAsset(e.target.value === "USDC" ? "USDC" : "SOL")}
              className={inputClass}
            >
              <option value="SOL">SOL</option>
              <option value="USDC">USDC</option>
            </select>
            <p className="text-[11px] text-muted">Hybrid mint txs currently assume SOL on-chain; USDC is stored for economics.</p>
          </div>
          <div className="space-y-2">
            <FieldLabel>Mint price ({quoteLabel})</FieldLabel>
            <input
              name="mintPriceSol"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
            <p className="text-[11px] text-muted">
              Bounds use SOL numerics ({LAUNCH_ECONOMICS_POLICY.MIN_MINT_PRICE_SOL}–{LAUNCH_ECONOMICS_POLICY.MAX_MINT_PRICE_SOL}{" "}
              SOL) for policy checks.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Display price label</FieldLabel>
            <input
              name="priceLabel"
              placeholder={`${priceInput || "0.2"} ${quoteLabel}`}
              className={inputClass}
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Genesis mint fee (minters)</FieldLabel>
            <input
              disabled
              readOnly
              value={
                valid
                  ? `${GENESIS_MINT_TAX_PCT_LABEL} of mint price → +${formatSol(exampleGenesisTaxLamports)} per mint (SOL tax path)`
                  : `${GENESIS_MINT_TAX_PCT_LABEL} of mint price`
              }
              className="w-full cursor-not-allowed rounded-xl border border-line/60 bg-panel px-4 py-3 text-sm text-muted"
            />
          </div>
        </div>

        {policyError ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
            {explainLaunchEconomicsError(policyError)}
          </div>
        ) : null}

        <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
          <p className="text-[10px] uppercase tracking-wider text-accent">Primary raise (if all mint)</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">
            {valid ? `${formatNumber(supplyNum)} × ${formatNumber(priceNum)} ${quoteLabel}` : "—"}
            <span className="ml-2 text-sm font-normal text-muted">≈</span>
            <span className={`ml-2 ${valid ? "text-accent" : "text-muted"}`}>
              {Number.isFinite(totalQuote) ? `${formatNumber(totalQuote)} ${quoteLabel}` : "—"}
            </span>
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Policy cap is evaluated in SOL-notional terms for supply × price (see error message if over cap). Vault
            wiring happens on the trade page after publish.
          </p>
        </div>
      </Section>

      <Section
        step="05"
        title="1B token split (Slice B)"
        subtitle="slice_b_reserve_bps ≤ 1000 (10%) and slice_b_creator_of_reserve_bps ≤ 10000 on initialize_launch."
      >
        <input type="hidden" name="sliceBPct" value={String(sliceBPct)} />
        <input type="hidden" name="sliceBCreatorSharePct" value={String(sliceBCreatorSharePct)} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Slice B reserve (% of 1B)</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={sliceBPct}
                onChange={(e) => setSliceBPct(Number(e.target.value))}
                className="flex-1 accent-accent"
                aria-label="Slice B percent of total supply"
              />
              <span className="w-12 text-right text-sm font-medium text-white">{sliceBPct}%</span>
            </div>
            <p className="text-[11px] text-muted">
              On deploy: <code className="text-[10px]">slice_b_reserve_bps = {sliceBPct * 100}</code> (0–1000).
            </p>
          </div>
          <div className="space-y-2">
            <FieldLabel>Your share of Slice B</FieldLabel>
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
                aria-label="Creator percent of slice B"
              />
              <span className="w-12 text-right text-sm font-medium text-white">{sliceBCreatorSharePct}%</span>
            </div>
            <p className="text-[11px] text-muted">
              {sliceBPct === 0
                ? "—"
                : `Deploy maps creator share to bps of the Slice B reserve (0–10000).`}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Slice A" value={`${sliceAPct}%`} sub={`≈ ${sliceAWholeTokens.toLocaleString()} tokens`} />
          <Stat
            label="Slice B"
            value={`${sliceBPct}%`}
            sub={sliceBPct === 0 ? "None" : `${sliceBWholeTokens.toLocaleString()} tokens reserved`}
          />
          <Stat label="Total SPL" value="1B" sub="Fixed in product economics" />
        </div>
      </Section>

      <Section
        step="06"
        title="Creator vesting & holder rewards (tokens)"
        subtitle="Off-chain schedule intent for docs and deploy UI; claims are enforced on-chain when configured."
      >
        <input type="hidden" name="creatorVestingSupplyPct" value={String(vestingPct)} />
        <input type="hidden" name="creatorVestingCliffMonths" value={String(vestingCliff)} />
        <input type="hidden" name="creatorVestingPeriodMonths" value={String(vestingPeriod)} />
        <input type="hidden" name="tokenHolderRewardPct" value={String(tokenHolderRewardPct)} />

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel>Reserve vesting (% of 1B)</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={vestingPct}
                onChange={(e) => setVestingPct(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="w-12 text-right text-sm font-medium text-white">{vestingPct}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <FieldLabel>Cliff (months)</FieldLabel>
            <select
              value={vestingCliff}
              onChange={(e) => setVestingCliff(Number(e.target.value))}
              disabled={vestingPct === 0}
              className={`${inputClass} disabled:opacity-50`}
            >
              {[0, 1, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "No cliff" : `${m} mo`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <FieldLabel>Vesting period (months)</FieldLabel>
            <select
              value={vestingPeriod}
              onChange={(e) => setVestingPeriod(Number(e.target.value))}
              disabled={vestingPct === 0}
              className={`${inputClass} disabled:opacity-50`}
            >
              {[3, 6, 12, 18, 24, 36, 48].map((m) => (
                <option key={m} value={m}>
                  {m} mo
                </option>
              ))}
            </select>
          </div>
        </div>

        {vestingPct > 0 ? (
          <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
            <p className="text-[10px] uppercase tracking-wider text-accent">Per unlocked wave</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-16 text-right text-[10px] uppercase text-muted">You</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={tokenHolderRewardPct}
                onChange={(e) => setTokenHolderRewardPct(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="w-16 text-[10px] uppercase text-muted">Holders</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
                <p className="text-[10px] uppercase text-muted">To you</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">{tokensToCreator.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
                <p className="text-[10px] uppercase text-muted">To holders</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">{tokensToHolders.toLocaleString()}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">≈ {tokensPerMonth.toLocaleString()} tokens / month during vesting.</p>
          </div>
        ) : null}
      </Section>

      <Section
        step="07"
        title="DAMM trading tax · creator vs Genesis Pass"
        subtitle="Matches launch-controller `split_trading_tax_settlement`. Saved as holder_reward_pct and nft_holder_share_bps (= pct × 100) for deploy."
      >
        <input type="hidden" name="holderRewardPct" value={String(holderRewardPct)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Tax on swap volume" value={tradingTaxPctLabel()} sub="TRADING_TAX_BPS = 300" />
          <Stat
            label="Platform (of tax)"
            value={bpsToPctLabel(platformShareOfTradeApproxBps())}
            sub="20% of tax · TRADING_TAX_PLATFORM_LEG_BPS"
          />
          <Stat
            label="Creator leg (of tax)"
            value={bpsToPctLabel(creatorLegOfTradeApproxBps())}
            sub="Remainder (~80% of tax) — you split below"
          />
        </div>
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
          <p className="text-[10px] uppercase tracking-wider text-accent">
            Split creator leg ({bpsToPctLabel(creatorLegOfTradeApproxBps())} of volume ≈)
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Slider sets what share of the <strong className="text-white/85">creator leg</strong> routes to the NFT
            holder reward index on-chain ({creatorSelfPct}% to your vault · {holderRewardPct}% to holders).
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-16 text-right text-[10px] uppercase text-muted">You</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={holderRewardPct}
              onChange={(e) => setHolderRewardPct(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="w-16 text-[10px] uppercase text-muted">Holders</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
              <p className="text-[10px] uppercase text-muted">You (approx. of trade)</p>
              <p className="mt-1 font-display text-lg font-semibold text-white">
                {bpsToPctLabel(tradingSplitDisplay.creatorVaultApproxBps)}
              </p>
            </div>
            <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
              <p className="text-[10px] uppercase text-muted">Holders (approx. of trade)</p>
              <p className="mt-1 font-display text-lg font-semibold text-white">
                {bpsToPctLabel(tradingSplitDisplay.holderApproxBps)}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>Phase label</FieldLabel>
          <input
            name="phase"
            placeholder="Public mint"
            className={inputClass}
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Creator fee wallet</FieldLabel>
          <input
            name="creatorTreasury"
            placeholder="Your Solana address (optional; defaults empty)"
            className={`${inputClass} font-mono`}
            value={creatorTreasury}
            onChange={(e) => setCreatorTreasury(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted">
          Status stays <span className="text-white/90">upcoming</span> until Alpha Vault + Core collection are linked on
          the trade page; mint UI follows on-chain lifecycle.
        </p>
      </Section>

      <Section
        step="08"
        title="Reward timing (slots)"
        subtitle="U64 values stored for CreatorRewardConfig-style deploys. Empty max claim = no cap."
      >
        <input type="hidden" name="creatorRewardVestingSlots" value={creatorRewardVestingSlots} />
        <input type="hidden" name="creatorRewardClaimStartDelaySlots" value={creatorRewardDelaySlots} />
        <input type="hidden" name="creatorRewardTransferCooldownSlots" value={creatorRewardCooldownSlots} />
        <input type="hidden" name="creatorRewardMaxClaimPerEpoch" value={creatorRewardMaxClaimPerEpoch} />
        <input type="hidden" name="creatorRewardIncentiveShareBps" value={String(creatorRewardIncentiveSharePct * 100)} />
        <input type="hidden" name="creatorRewardImmutableAfterLaunch" value={creatorRewardImmutable ? "1" : "0"} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-vest">Vesting duration (slots)</FieldLabel>
            <input
              id="cr-vest"
              className={`${inputClass} font-mono`}
              value={creatorRewardVestingSlots}
              onChange={(e) => setCreatorRewardVestingSlots(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-[11px] text-muted">Default ~216000 (~1 day wall time at typical slot rates).</p>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-delay">Claim start delay (slots)</FieldLabel>
            <input
              id="cr-delay"
              className={`${inputClass} font-mono`}
              value={creatorRewardDelaySlots}
              onChange={(e) => setCreatorRewardDelaySlots(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-cool">Transfer cooldown (slots)</FieldLabel>
            <input
              id="cr-cool"
              className={`${inputClass} font-mono`}
              value={creatorRewardCooldownSlots}
              onChange={(e) => setCreatorRewardCooldownSlots(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-max">Max claim / epoch (raw units)</FieldLabel>
            <input
              id="cr-max"
              placeholder="Empty = u64 max"
              className={`${inputClass} font-mono`}
              value={creatorRewardMaxClaimPerEpoch}
              onChange={(e) => setCreatorRewardMaxClaimPerEpoch(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel/40 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted">Creator → holder incentive bps</p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={creatorRewardIncentiveSharePct}
            onChange={(e) => setCreatorRewardIncentiveSharePct(Number(e.target.value))}
            className="mt-3 w-full accent-accent"
          />
          <p className="mt-2 font-mono text-xs text-white/80">{creatorRewardIncentiveSharePct * 100} / 10000 bps</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/70 bg-panel/40 p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-line accent-accent"
            checked={creatorRewardImmutable}
            onChange={(e) => setCreatorRewardImmutable(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-white/90">Immutable reward config after trading</span>
            <span className="mt-1 block text-[11px] text-muted">Matches on-chain guard when you enable it at deploy.</span>
          </span>
        </label>
      </Section>

      <div ref={footerRef} className="rounded-2xl border border-white/[0.06] bg-panel/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Platform deploy fee (display)</p>
            <p className="mt-1 font-display text-xl font-semibold text-white">
              {formatSol(PLATFORM_DEPLOY_FEE_LAMPORTS)}
              <span className="ml-2 text-sm font-normal text-muted">one-time</span>
            </p>
            <p className="mt-2 max-w-prose text-xs text-muted">
              You still pay Solana rent and Meteora program fees when you sign deploy transactions on the trade page.
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || !publishFormValid}
            title={
              !publishFormValid
                ? "Fix supply × price (step 04), slug (3–64, a–z 0–9 -), and token symbol (2–10) before publishing."
                : undefined
            }
            className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-accent px-10 py-3.5 text-sm font-semibold text-ink shadow-[0_0_32px_rgba(200,255,0,0.15)] transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Publishing…" : "Publish launch"}
          </button>
        </div>
        {submitHint ? <p className="mt-3 text-xs text-amber-200">{submitHint}</p> : null}
        {state.message ? (
          <p className={`mt-3 text-sm ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
