"use client";

import { useActionState, useMemo, useState } from "react";

import { createDraftCollection, type CreateLaunchState } from "@/app/create/actions";
import { ProjectPageFormFields } from "@/components/launch/ProjectPageFormFields";
import {
  explainLaunchEconomicsError,
  LAUNCH_ECONOMICS_POLICY,
  validateLaunchEconomicsInputs,
} from "@/lib/launch/launch-economics-policy";
import { projectPageDocFromAiStoryBlocks, type FullProjectCopy } from "@/lib/ai/full-project-copy";
import { isValidAccentColor, type ProjectPageDoc } from "@/lib/launch/project-page";
import { serializeTokenMetadataProfile, type TokenMetadataProfile } from "@/lib/launch/token-metadata-profile";

import {
  genesisMintTaxTotalLamports,
  GENESIS_MINT_TAX_BPS,
  mintPriceSolToLamports,
} from "@/lib/launch/genesis-mint-tax";

import { LaunchArtStudio } from "./LaunchArtStudio";

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

function readBpsEnv(value: string | undefined, fallback: number): number {
  const raw = Number(value?.trim());
  if (!Number.isFinite(raw) || raw < 0 || raw > 9999) return fallback;
  return Math.round(raw);
}

function readPctEnv(value: string | undefined, fallback: number): number {
  const raw = Number(value?.trim());
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return fallback;
  return Math.round(raw);
}

/** DAMM / secondary-market fee split (display on create flow only; on-chain fees are program + Meteora). */
const TRADING_FEE_TOTAL_BPS = readBpsEnv(process.env.NEXT_PUBLIC_PLATFORM_TRADING_FEE_BPS, 300);
const TRADING_FEE_PLATFORM_BPS = Math.min(
  TRADING_FEE_TOTAL_BPS,
  readBpsEnv(process.env.NEXT_PUBLIC_PLATFORM_TRADING_PLATFORM_BPS, 100),
);
const TRADING_FEE_CREATOR_POT_BPS = Math.max(0, TRADING_FEE_TOTAL_BPS - TRADING_FEE_PLATFORM_BPS);
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

type AssistData = {
  tagline: string;
  description: string;
  tokenSymbol: string;
  suggestedSupply: number;
  suggestedMintPriceSol: number;
  utilities: string[];
  creatorVestingSupplyPct?: number;
  creatorVestingCliffMonths?: number;
  creatorVestingPeriodMonths?: number;
  tokenHolderRewardPct?: number;
};

type AssistResponse = {
  ok: boolean;
  message?: string;
  data?: AssistData;
};

type FullProjectApiResponse =
  | {
      ok: true;
      data: {
        copy: FullProjectCopy;
        images: { bannerUrl: string | null; logoUrl: string | null; galleryUrl: string | null };
        imageErrors?: string[];
      };
    }
  | { ok: false; message?: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function CreateLaunchForm() {
  const [state, action, pending] = useActionState(createDraftCollection, initialState);

  // Controlled state for everything the AI assist can populate. Supply +
  // price stay controlled so the primary-raise readout updates live.
  const [name, setName] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [slugTouched, setSlugTouched] = useState<boolean>(false);
  const [tagline, setTagline] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [utilities, setUtilities] = useState<string>("");
  const [supplyInput, setSupplyInput] = useState<string>("1000");
  const [priceInput, setPriceInput] = useState<string>("0.2");
  const [quoteAsset, setQuoteAsset] = useState<"SOL" | "USDC">("SOL");
  const [priceLabel, setPriceLabel] = useState<string>("");
  const [phase, setPhase] = useState<string>("");
  const [creatorTreasury, setCreatorTreasury] = useState<string>("");
  const [holderRewardPct, setHolderRewardPct] = useState<number>(DEFAULT_HOLDER_REWARD_PCT);
  const creatorSelfPct = 100 - holderRewardPct;
  const creatorSelfBps = Math.round((TRADING_FEE_CREATOR_POT_BPS * creatorSelfPct) / 100);
  const holderBps = TRADING_FEE_CREATOR_POT_BPS - creatorSelfBps;

  // Creator vesting (locked tokens released linearly after unlock schedule).
  const [vestingPct, setVestingPct] = useState<number>(0);
  const [vestingCliff, setVestingCliff] = useState<number>(0);
  const [vestingPeriod, setVestingPeriod] = useState<number>(12);
  const [tokenHolderRewardPct, setTokenHolderRewardPct] = useState<number>(0);
  const [sliceBPct, setSliceBPct] = useState<number>(0);
  const [sliceBCreatorSharePct, setSliceBCreatorSharePct] = useState<number>(50);

  /** Stored for deploy-time `CreatorRewardConfig` + docs; L3 only — no off-chain entitlement math. */
  const [creatorRewardVestingSlots, setCreatorRewardVestingSlots] = useState<string>("216000");
  const [creatorRewardDelaySlots, setCreatorRewardDelaySlots] = useState<string>("0");
  const [creatorRewardCooldownSlots, setCreatorRewardCooldownSlots] = useState<string>("0");
  const [creatorRewardMaxClaimPerEpoch, setCreatorRewardMaxClaimPerEpoch] = useState<string>("");
  const [creatorRewardIncentiveSharePct, setCreatorRewardIncentiveSharePct] = useState<number>(0);
  const [creatorRewardImmutable, setCreatorRewardImmutable] = useState<boolean>(false);

  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [metaProfile, setMetaProfile] = useState<TokenMetadataProfile>({});
  const [socialWebsite, setSocialWebsite] = useState<string>("");
  const [socialTwitter, setSocialTwitter] = useState<string>("");
  const [socialDiscord, setSocialDiscord] = useState<string>("");
  const [socialTelegram, setSocialTelegram] = useState<string>("");
  const [imageStyleHint, setImageStyleHint] = useState<string>("");

  const [projectPageDoc, setProjectPageDoc] = useState<ProjectPageDoc>(() => ({
    blocks: [],
    hideDefaultDescription: false,
    hideDefaultStats: false,
  }));
  const [projectAccentColor, setProjectAccentColor] = useState<string>("");
  const [projectHeroLayout, setProjectHeroLayout] = useState<string>("classic");
  const [projectPageHeadline, setProjectPageHeadline] = useState<string>("");
  const [projectPageSubhead, setProjectPageSubhead] = useState<string>("");

  // 1B total supply; vesting % is applied to the whole supply.
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

  /** AI runs: `"assist"` fast name-only backup; `"full"` art + metadata + project page. */
  const [aiPhase, setAiPhase] = useState<"idle" | "assist" | "full">("idle");
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistWarn, setAssistWarn] = useState<string | null>(null);
  const aiBusy = aiPhase !== "idle";

  // Auto-derive a URL slug from the name unless the user has typed their own.
  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  /** Applies launch-assist shaped payload (chat-only assist or full-project copy). */
  function applyLaunchAssistPayload(d: AssistData, launchName: string) {
    setTagline(d.tagline);
    setDescription(d.description);
    setTokenSymbol(d.tokenSymbol);
    setTokenName((t) => (t.trim() ? t : launchName));
    setSupplyInput(String(d.suggestedSupply));
    setPriceInput(String(d.suggestedMintPriceSol));
    setUtilities(d.utilities.join(", "));
    if (typeof d.creatorVestingSupplyPct === "number") {
      setVestingPct(Math.max(0, Math.min(50, Math.round(d.creatorVestingSupplyPct))));
    }
    if (typeof d.creatorVestingCliffMonths === "number") {
      const c = Math.max(0, Math.min(24, Math.round(d.creatorVestingCliffMonths)));
      const allowed = [0, 1, 3, 6, 12];
      setVestingCliff(allowed.reduce((best, cur) => (Math.abs(cur - c) < Math.abs(best - c) ? cur : best), 0));
    }
    if (typeof d.creatorVestingPeriodMonths === "number") {
      const p = Math.max(3, Math.min(48, Math.round(d.creatorVestingPeriodMonths)));
      const allowed = [3, 6, 12, 18, 24, 36, 48];
      setVestingPeriod(allowed.reduce((best, cur) => (Math.abs(cur - p) < Math.abs(best - p) ? cur : best), 12));
    }
    if (typeof d.tokenHolderRewardPct === "number") {
      const v = Math.max(0, Math.min(100, Math.round(d.tokenHolderRewardPct / 5) * 5));
      setTokenHolderRewardPct(v);
    }
  }

  /**
   * One control: full launch when description has enough context; otherwise a quick
   * pass from the launch name (same button — add description and run again for everything).
   */
  async function runAiForStep01() {
    if (!name.trim()) {
      setAssistError("Add your launch name first.");
      return;
    }
    setAssistError(null);
    setAssistWarn(null);

    const useFull = description.trim().length >= 12;
    setAiPhase(useFull ? "full" : "assist");
    try {
      if (useFull) {
        const r = await fetch("/api/ai/generate-full-project", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectName: name.trim(),
            projectDescription: description.trim(),
          }),
        });
        const j = (await r.json()) as FullProjectApiResponse;
        if (!j.ok || !j.data) {
          throw new Error((j as { message?: string }).message ?? `Request failed (${r.status})`);
        }
        const { copy, images, imageErrors } = j.data;
        applyLaunchAssistPayload(copy, name.trim());
        setHolderRewardPct(Math.max(0, Math.min(100, Math.round(copy.holderRewardPct))));
        setPhase(copy.phase?.trim() ?? "");
        setImageStyleHint(copy.styleHint?.trim() ?? "");
        setMetaProfile({
          story: copy.story,
          roadmap: copy.roadmap,
          community: copy.community,
        });
        if (images.bannerUrl) setBannerUrl(images.bannerUrl);
        if (images.logoUrl) setLogoUrl(images.logoUrl);
        if (images.galleryUrl) setGalleryUrls([images.galleryUrl]);

        const ac = copy.projectAccentHex?.trim() ?? "";
        setProjectAccentColor(ac && isValidAccentColor(ac) ? ac : "");
        const layout = copy.projectHeroLayout;
        setProjectHeroLayout(
          layout === "minimal" || layout === "split" || layout === "classic" ? layout : "classic",
        );
        setProjectPageHeadline((copy.projectPageHeadline ?? "").trim().slice(0, 200));
        setProjectPageSubhead((copy.projectPageSubhead ?? "").trim().slice(0, 400));
        setProjectPageDoc(
          projectPageDocFromAiStoryBlocks({
            projectTextBlocks: copy.projectTextBlocks ?? [],
            projectFaq: copy.projectFaq ?? [],
            projectHideDefaultDescription: !!copy.projectHideDefaultDescription,
            projectHideDefaultStats: !!copy.projectHideDefaultStats,
          }),
        );

        if (imageErrors?.length) {
          setAssistWarn(`Mostly done — a few images failed: ${imageErrors.join(" · ")}`);
        }
      } else {
        const r = await fetch("/api/ai/launch-assist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const j = (await r.json()) as AssistResponse;
        if (!j.ok || !j.data) {
          throw new Error(j.message ?? `AI request failed (${r.status})`);
        }
        applyLaunchAssistPayload(j.data, name.trim());
        const need = 12 - description.trim().length;
        setAssistWarn(
          `Starter copy saved from your launch name. Add ${need} more character${need === 1 ? "" : "s"} to the description, then Generate with AI again — same button pulls in artwork, explorer fields, and your /project story page.`,
        );
      }
    } catch (e) {
      setAssistError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setAiPhase("idle");
    }
  }

  const { supplyNum, priceNum, totalSol, valid, policyError, exampleGenesisTaxLamports } = useMemo(() => {
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
      totalSol: numbersOk ? s * p : NaN,
      valid: v,
      policyError: err,
      exampleGenesisTaxLamports,
    };
  }, [supplyInput, priceInput]);

  const trimmedDescForAi = description.trim();
  const charsToFullAi = Math.max(0, 12 - trimmedDescForAi.length);
  const fullAiReady = trimmedDescForAi.length >= 12;

  return (
    <form
      action={action}
      className="space-y-8"
      onSubmit={(e) => {
        const ac = projectAccentColor.trim();
        if (ac && !isValidAccentColor(ac)) {
          e.preventDefault();
          setAssistError("Fix project page accent color (valid #hex like #7CFFB2, or leave empty for platform default).");
        }
      }}
    >
      <Section
        step="01"
        title="Brand, story & launch visuals"
        subtitle="Everything discoverable on the grid, mint, trade pages, SPL/NFT metadata, and your storage-backed art lives here — generate or edit in one place."
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Listing copy</p>
          <p className="mt-1 text-xs text-muted">Home grid, mint page, launch headline.</p>
        </div>

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
            <p className="text-[11px] text-muted">Becomes /mint/your-slug and /launch/your-slug. Lowercase, hyphens.</p>
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>Tagline</FieldLabel>
          <input
            name="tagline"
            placeholder="One line that sells the vibe"
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
            placeholder="Tell collectors what makes this launch special, perks, roadmap, and how the Genesis Pass + token fit together."
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-accent/35 bg-gradient-to-b from-accent/[0.08] to-black/20 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">AI assistant</p>
              <h3 className="mt-1 font-display text-base font-semibold text-white sm:text-lg">
                Generate this step in one go
              </h3>
              <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-muted">
                One button: with a short description (12+ characters), we fill listing copy and token defaults,{" "}
                <span className="text-white/85">DALL·E</span> banner, logo, gallery, explorer metadata, and your{" "}
                <span className="text-white/85">/project</span> page (accent, hero layout, story blocks). Name only? We
                still draft basics — add a line or two above and tap the same button again for artwork and
                the project page.
              </p>
            </div>
            <div
              className={`shrink-0 rounded-xl border px-3 py-2 text-center sm:text-left ${
                fullAiReady
                  ? "border-accent/40 bg-accent/[0.07] text-accent"
                  : "border-white/[0.08] bg-black/25 text-muted"
              }`}
              role="status"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Full AI</p>
              <p className="mt-1 font-mono text-sm font-semibold text-white">
                {fullAiReady ? "Ready" : `${charsToFullAi} char${charsToFullAi === 1 ? "" : "s"} left`}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-muted">in description (min. 12)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runAiForStep01()}
            disabled={aiBusy || !name.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-ink shadow-[0_8px_28px_rgba(124,255,178,0.12)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
          >
            {aiPhase === "full"
              ? "Working… (~2–5 min, keep tab open)"
              : aiPhase === "assist"
                ? "Working…"
                : "Generate with AI"}
          </button>

          {assistError ? <p className="mt-4 text-xs text-rose-300">{assistError}</p> : null}
          {assistWarn ? <p className="mt-4 text-xs text-amber-200/95">{assistWarn}</p> : null}
        </div>

        <div className="relative border-t border-white/[0.08] pt-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Launch art studio</p>
          <p className="mt-1 text-xs text-muted">
            Stable https art for metadata; optional manual paste links. Banner, logo, gallery, explorer copy, paired NFTs,
            extra socials — all serialized with your publish payload.
          </p>
          <div className="mt-6">
            <LaunchArtStudio
              variant="create"
              name={name}
              tagline={tagline}
              description={description}
              styleHint={imageStyleHint}
              onStyleHintChange={setImageStyleHint}
              galleryUrls={galleryUrls}
              setGalleryUrls={setGalleryUrls}
              bannerUrl={bannerUrl}
              logoUrl={logoUrl}
              onBannerUrlChange={setBannerUrl}
              onLogoUrlChange={setLogoUrl}
              metaProfile={metaProfile}
              onMetaProfileChange={setMetaProfile}
              socialWebsite={socialWebsite}
              socialTwitter={socialTwitter}
              socialDiscord={socialDiscord}
              socialTelegram={socialTelegram}
              onSocialWebsite={setSocialWebsite}
              onSocialTwitter={setSocialTwitter}
              onSocialDiscord={setSocialDiscord}
              onSocialTelegram={setSocialTelegram}
            />
          </div>
          <input type="hidden" name="nftGalleryUrls" value={JSON.stringify(galleryUrls)} />
          <input
            type="hidden"
            name="tokenMetadataProfile"
            value={JSON.stringify(serializeTokenMetadataProfile(metaProfile))}
          />
        </div>

        <div className="relative mt-10 space-y-6 border-t border-white/[0.08] pt-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Project page</p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
              Matches the customize page editor after launch: accent and hero layout only affect{" "}
              <span className="text-white/85">/project/[slug]</span> · home grid and trade UI stay on platform defaults.
              Classic hero uses your banner + logo so the drop reads well at full width.
            </p>
          </div>
          <ProjectPageFormFields
            doc={projectPageDoc}
            setDoc={setProjectPageDoc}
            accentColor={projectAccentColor}
            setAccentColor={setProjectAccentColor}
            heroLayout={projectHeroLayout}
            setHeroLayout={setProjectHeroLayout}
            projectHeadline={projectPageHeadline}
            setProjectHeadline={setProjectPageHeadline}
            projectSubhead={projectPageSubhead}
            setProjectSubhead={setProjectPageSubhead}
            namePlaceholder={name.trim() ? name : "Bonk Cadets"}
            taglinePlaceholder={tagline.trim() ? tagline : "Chibi shiba astronauts riding the vault to orbit."}
            heroLayoutRadioName="createHeroLayout"
          />
          <input type="hidden" name="projectPagePayload" value={JSON.stringify(projectPageDoc)} />
          <input type="hidden" name="accentColor" value={projectAccentColor} />
          <input type="hidden" name="heroLayout" value={projectHeroLayout} />
          <input type="hidden" name="projectHeadline" value={projectPageHeadline} />
          <input type="hidden" name="projectSubhead" value={projectPageSubhead} />
        </div>
      </Section>

      <Section
        step="02"
        title="Genesis Pass NFT + Alpha Vault mint price"
        subtitle="Set NFT supply, quote asset (SOL or USDC), and per-pass price — each mint deposits this amount into your Meteora Alpha Vault (vault setup on the trade page). Hybrid mint transactions currently assume SOL on-chain."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel>NFT supply</FieldLabel>
            <input
              name="supply"
              value={supplyInput}
              onChange={(e) => setSupplyInput(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
            <p className="text-[11px] text-muted">
              Total Genesis Passes · {LAUNCH_ECONOMICS_POLICY.MIN_SUPPLY.toLocaleString()}–{LAUNCH_ECONOMICS_POLICY.MAX_SUPPLY.toLocaleString()} ·
              all open at launch
            </p>
          </div>
          <div className="space-y-2">
            <FieldLabel>Quote asset</FieldLabel>
            <select
              name="quoteAsset"
              value={quoteAsset}
              onChange={(e) => setQuoteAsset(e.target.value === "USDC" ? "USDC" : "SOL")}
              className={inputClass}
            >
              <option value="SOL">SOL</option>
              <option value="USDC">USDC</option>
            </select>
            <p className="text-[11px] text-muted">Stored on the launch row for economics and future vault wiring.</p>
          </div>
          <div className="space-y-2">
            <FieldLabel>Mint price ({quoteAsset})</FieldLabel>
            <input
              name="mintPriceSol"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
            <p className="text-[11px] text-muted">
              {`${LAUNCH_ECONOMICS_POLICY.MIN_MINT_PRICE_SOL}–${LAUNCH_ECONOMICS_POLICY.MAX_MINT_PRICE_SOL} ${quoteAsset} per NFT · same price for every pass (fair launch)`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel/30 p-5">
          <p className="text-[10px] uppercase tracking-wider text-accent">Fair launch pricing</p>
          <p className="mt-1 text-sm text-white">Flat mint — every Genesis Pass is the same {quoteAsset}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Alpha Vault primary mints use one price for the whole supply. Size your vault caps in Meteora against supply ×
            price below.
          </p>
        </div>

        {policyError ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
            {explainLaunchEconomicsError(policyError)}
          </div>
        ) : null}

        <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-wider text-accent">Primary raise (if all mint)</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              Max: {LAUNCH_ECONOMICS_POLICY.MAX_VAULT_RAISE_SOL.toLocaleString()} SOL notional cap (same numeric bounds for USDC)
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className="font-display text-2xl font-semibold text-white">
              {valid ? `${formatNumber(supplyNum)} × ${formatNumber(priceNum)} ${quoteAsset}` : "—"}
              <span className="ml-2 text-sm font-normal text-muted">=</span>
              <span
                className={`ml-2 ${
                  valid
                    ? "text-accent"
                    : Number.isFinite(totalSol)
                      ? "text-rose-300"
                      : "text-muted"
                }`}
              >
                {Number.isFinite(totalSol) ? `${formatNumber(totalSol)} ${quoteAsset}` : "—"}
              </span>
              <span className="ml-2 text-sm font-normal text-muted">total vault deposits</span>
            </p>
          </div>
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted">
            Every Genesis Pass mint deposits{" "}
            <span className="text-white/90">{valid ? `${formatNumber(priceNum)}` : "—"} SOL</span> into your Meteora Alpha
            Vault. When all <span className="text-white/90">{valid ? formatNumber(supplyNum) : "—"}</span> passes mint,
            that is the total quote-side liquidity contributed through this launchpad (vault rules and DAMM migration are
            configured in Meteora).
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Display price</FieldLabel>
            <input
              name="priceLabel"
              placeholder={`${priceInput || "0.2"} SOL`}
              className={inputClass}
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
            />
            <p className="text-[11px] text-muted">Shown on cards · just for display</p>
          </div>
          <div className="space-y-2">
            <FieldLabel>Mint fee (minters)</FieldLabel>
            <input
              disabled
              readOnly
              value={
                valid
                  ? `${GENESIS_MINT_TAX_PCT_LABEL} of mint price → +${formatSol(exampleGenesisTaxLamports)} per mint`
                  : `${GENESIS_MINT_TAX_PCT_LABEL} of mint price`
              }
              className="w-full cursor-not-allowed rounded-xl border border-line/60 bg-panel px-4 py-3 text-sm text-muted"
            />
            <p className="text-[11px] text-muted">
              Minters pay the mint price to the vault plus this small extra to the platform. Same idea as the live app.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>Utilities (comma-separated)</FieldLabel>
          <input
            name="utilities"
            placeholder="Genesis Pass, Fee share, Allowlist"
            className={inputClass}
            value={utilities}
            onChange={(e) => setUtilities(e.target.value)}
          />
        </div>
      </Section>

      <Section
        step="03"
        title="Paired token"
        subtitle="Your launch token symbol and name — the SPL mint is created when you set up liquidity in Meteora (Alpha Vault / DAMM)."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Token name</FieldLabel>
            <input
              name="tokenName"
              required
              placeholder="Bonk Cadets"
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
            <p className="text-[11px] text-muted">2–10 uppercase letters/numbers</p>
          </div>
        </div>
        <p className="text-xs text-muted">
          We still store a canonical 1B supply figure for metadata compatibility. Actual minting and LP come from your
          Meteora Alpha Vault workflow — optional vesting is configured in the next step.
        </p>
      </Section>

      <Section
        step="03b"
        title="1B token split (Slice A vs Slice B)"
        subtitle="Slice A is the vault, pool, and program path (default 100%). Slice B is an optional reserve (up to 10% of 1B) split between you and Genesis Pass holders — committed on-chain at deploy."
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
              {sliceBPct === 0
                ? "All 1B tokens follow Slice A (Meteora + program mechanics)."
                : `${sliceBWholeTokens.toLocaleString()} tokens reserved in Slice B; the rest stay in Slice A.`}
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
                : `Creator ≈ ${sliceBCreatorWhole.toLocaleString()} · Holders ≈ ${sliceBHolderWhole.toLocaleString()} (whole tokens, rounded)`}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Slice A (vault / LP path)"
            value={`${sliceAPct}%`}
            sub={`≈ ${sliceAWholeTokens.toLocaleString()} whole tokens`}
          />
          <Stat
            label="Slice B reserve"
            value={`${sliceBPct}%`}
            sub={sliceBPct === 0 ? "Opt-in only" : "Creator + holder pool (on-chain schedule at deploy)"}
          />
          <Stat
            label="Total project SPL"
            value="1B"
            sub="Fixed supply · decimals chosen at pool deploy"
          />
        </div>
      </Section>

      <Section
        step="04"
        title="Creator vesting & holder rewards"
        subtitle="Optional: reserve a slice of supply for yourself, released in monthly waves after your token unlock schedule. You can stream a chosen % of each wave to your Genesis Pass holders."
      >
        <input type="hidden" name="creatorVestingSupplyPct" value={String(vestingPct)} />
        <input type="hidden" name="creatorVestingCliffMonths" value={String(vestingCliff)} />
        <input type="hidden" name="creatorVestingPeriodMonths" value={String(vestingPeriod)} />
        <input type="hidden" name="tokenHolderRewardPct" value={String(tokenHolderRewardPct)} />

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel>Reserve for yourself</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={vestingPct}
                onChange={(e) => setVestingPct(Number(e.target.value))}
                className="flex-1 accent-accent"
                aria-label="Reserve % of supply"
              />
              <span className="w-12 text-right text-sm font-medium text-white">{vestingPct}%</span>
            </div>
            <p className="text-[11px] text-muted">
              {vestingPct === 0
                ? "No vesting · 100% follows your Meteora setup"
                : `${lockedTokens.toLocaleString()} tokens locked`}
            </p>
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
                  {m === 0 ? "No cliff" : `${m} month${m === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">After the cliff, unlock waves begin.</p>
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
                  {m} month{m === 1 ? "" : "s"} · {m} waves
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">
              {vestingPct === 0
                ? "—"
                : `≈ ${tokensPerMonth.toLocaleString()} tokens / month`}
            </p>
          </div>
        </div>

        {vestingPct > 0 ? (
          <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-accent">Reward Genesis Pass holders</p>
              <p className="text-xs text-muted">
                Each wave: {100 - tokenHolderRewardPct}% to you · {tokenHolderRewardPct}% to holders
              </p>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="w-16 text-right text-[10px] uppercase tracking-wider text-muted">You</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={tokenHolderRewardPct}
                onChange={(e) => setTokenHolderRewardPct(Number(e.target.value))}
                className="flex-1 accent-accent"
                aria-label="Token holder reward share"
              />
              <span className="w-16 text-[10px] uppercase tracking-wider text-muted">Holders</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted">Lifetime to you</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">
                  {tokensToCreator.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted">{100 - tokenHolderRewardPct}% of locked supply</p>
              </div>
              <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted">Lifetime to holders</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">
                  {tokensToHolders.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted">
                  {tokenHolderRewardPct}% · streamed pro-rata after each wave
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Vested tokens accrue in a Jupiter Locker linked to your wallet. After each monthly wave, claim them and
              click <span className="text-white/90">Reward holders</span> on your launch page to push the holders'
              share to current Genesis Pass owners pro-rata.
            </p>
          </div>
        ) : null}
      </Section>

      <Section
        step="05"
        title="Creator economics"
        subtitle="Reference split for any future on-chain fee routing you configure. Primary sales use the Meteora Alpha Vault path; trading uses DAMM v2 after pool setup."
      >
        <input type="hidden" name="holderRewardPct" value={String(holderRewardPct)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Total trading tax"
            value={bpsToPctLabel(TRADING_FEE_TOTAL_BPS)}
            sub="If you attach a tradable pool later"
          />
          <Stat
            label="Platform"
            value={bpsToPctLabel(TRADING_FEE_PLATFORM_BPS)}
            sub="Fixed · keeps the rails running"
          />
          <Stat
            label="Your pot (creator + holders)"
            value={bpsToPctLabel(TRADING_FEE_CREATOR_POT_BPS)}
            sub="Yours to split with your community"
          />
        </div>

        <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-accent">Split your {bpsToPctLabel(TRADING_FEE_CREATOR_POT_BPS)} pot</p>
            <p className="text-xs text-muted">
              {creatorSelfPct}% to you · {holderRewardPct}% to Genesis Pass holders
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="w-16 text-right text-[10px] uppercase tracking-wider text-muted">You</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={holderRewardPct}
              onChange={(e) => setHolderRewardPct(Number(e.target.value))}
              className="flex-1 accent-accent"
              aria-label="Holder reward share"
            />
            <span className="w-16 text-[10px] uppercase tracking-wider text-muted">Holders</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted">You earn</p>
              <p className="mt-1 font-display text-lg font-semibold text-white">
                {bpsToPctLabel(creatorSelfBps)}
              </p>
              <p className="text-[11px] text-muted">Your slice of the fee pot when trading is on.</p>
            </div>
            <div className="rounded-xl border border-line/70 bg-panel/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted">Genesis Pass holders earn</p>
              <p className="mt-1 font-display text-lg font-semibold text-white">
                {bpsToPctLabel(holderBps)}
              </p>
              <p className="text-[11px] text-muted">Their slice of the same pot when trading is on.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted">
          The real pool settings are set in Meteora when you create the pool. This is how you want the story told on
          cards and what we save for deploy.
        </p>
        <p className="text-[11px] text-muted">
          We store <span className="font-mono text-white/80">{holderRewardPct * 100}</span> bps toward the holder side
          of that trading-fee slice.
        </p>
        <div className="space-y-2">
          <FieldLabel>Phase name</FieldLabel>
          <input
            name="phase"
            placeholder="Public mint · Vault open"
            className={inputClass}
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Your wallet for creator fees</FieldLabel>
          <input
            name="creatorTreasury"
            placeholder="Your Solana address"
            className={`${inputClass} font-mono`}
            value={creatorTreasury}
            onChange={(e) => setCreatorTreasury(e.target.value)}
          />
          <p className="text-[11px] text-muted">Your Solana address for creator-side fees.</p>
        </div>
        <div className="rounded-xl border border-line/70 bg-panel/40 p-4 text-xs leading-relaxed text-muted">
          <p className="text-white/90">Mint opens only after on-chain deploy.</p>
          Your launch publishes as <span className="text-white/90">upcoming</span>. Mint goes live the moment your
          on-chain deploy finishes — never before. No pre-mints, no allowlists running ahead of your Alpha Vault wiring.
        </div>
      </Section>

      <Section
        step="06"
        title="Holder claim timing"
        subtitle="Optional. We save this with your launch for deploy. Solana enforces the real timing."
      >
        <input type="hidden" name="creatorRewardVestingSlots" value={creatorRewardVestingSlots} />
        <input type="hidden" name="creatorRewardClaimStartDelaySlots" value={creatorRewardDelaySlots} />
        <input type="hidden" name="creatorRewardTransferCooldownSlots" value={creatorRewardCooldownSlots} />
        <input type="hidden" name="creatorRewardMaxClaimPerEpoch" value={creatorRewardMaxClaimPerEpoch} />
        <input type="hidden" name="creatorRewardIncentiveShareBps" value={String(creatorRewardIncentiveSharePct * 100)} />
        <input type="hidden" name="creatorRewardImmutableAfterLaunch" value={creatorRewardImmutable ? "1" : "0"} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-vest-slots">Claim vesting window (slots)</FieldLabel>
            <input
              id="cr-vest-slots"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`${inputClass} font-mono`}
              value={creatorRewardVestingSlots}
              onChange={(e) => setCreatorRewardVestingSlots(e.target.value.replace(/\D/g, ""))}
              aria-describedby="cr-vest-hint"
            />
            <p id="cr-vest-hint" className="text-[11px] text-muted">
              Linear vesting duration in chain slots (default ~216k ≈ one wall-clock day at typical slot times).
            </p>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-delay-slots">Claim start delay (slots)</FieldLabel>
            <input
              id="cr-delay-slots"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`${inputClass} font-mono`}
              value={creatorRewardDelaySlots}
              onChange={(e) => setCreatorRewardDelaySlots(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-[11px] text-muted">Slots after the on-chain schedule anchor before the vesting clock runs.</p>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-cooldown-slots">Between-claim cooldown (slots)</FieldLabel>
            <input
              id="cr-cooldown-slots"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`${inputClass} font-mono`}
              value={creatorRewardCooldownSlots}
              onChange={(e) => setCreatorRewardCooldownSlots(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-[11px] text-muted">Minimum slots between claims when the config account is supplied.</p>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="cr-max-epoch">Max claim per reward epoch (raw units)</FieldLabel>
            <input
              id="cr-max-epoch"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`${inputClass} font-mono`}
              placeholder="Empty = max (u64)"
              value={creatorRewardMaxClaimPerEpoch}
              onChange={(e) => setCreatorRewardMaxClaimPerEpoch(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-[11px] text-muted">Cap per distribution epoch in reward-token smallest units; leave empty for no cap.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-transparent p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-accent">Creator → holder vault incentives</p>
            <p className="text-xs text-muted">0% = gate off · otherwise bps for optional creator-funded vault top-ups</p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            If you turn this on, it only does something when your on-chain setup supports it. This slider just saves
            your choice.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-14 text-right text-[10px] uppercase tracking-wider text-muted">Off</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={creatorRewardIncentiveSharePct}
              onChange={(e) => setCreatorRewardIncentiveSharePct(Number(e.target.value))}
              className="flex-1 accent-accent"
              aria-label="Creator incentive share percent for on-chain bps"
            />
            <span className="w-14 text-[10px] uppercase tracking-wider text-muted">100%</span>
          </div>
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
            <span className="block text-sm font-medium text-white/90">Lock these settings after trading goes live</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-muted">
              When on, you can&apos;t change these settings after trading goes live—Solana locks that for you.
            </span>
          </span>
        </label>
      </Section>

      <div className="rounded-2xl border border-white/[0.06] bg-panel/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Platform deploy fee</p>
            <p className="mt-1 font-display text-xl font-semibold text-white">
              {formatSol(PLATFORM_DEPLOY_FEE_LAMPORTS)}
              <span className="ml-2 text-sm font-normal text-muted">one-time</span>
            </p>
            <p className="mt-2 max-w-prose text-xs text-muted">
              On-chain setup is Alpha Vault + Metaplex Core — you pay normal Solana rent and Meteora program fees when you
              sign those transactions after publishing.
            </p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-accent px-10 py-3.5 text-sm font-semibold text-ink shadow-[0_0_32px_rgba(200,255,0,0.15)] transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Publishing…" : "Publish launch"}
          </button>
        </div>
      </div>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
