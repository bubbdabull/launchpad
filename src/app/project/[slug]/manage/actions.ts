"use server";

/**
 * Launch-management server actions.
 *
 * Two distinct surfaces live in this file:
 *
 *   - `updateLaunchSettings` — the catch-all "edit launch" flow. Called
 *     from the launch settings form to update marketing-style fields
 *     (name, tagline, description, banner, logo, utilities, phase,
 *     category) plus a few off-chain economic dials (holder reward %,
 *     token holder reward %).
 *
 *   - `setLaunchPublished` — the publish/unpublish toggle. Hidden
 *     launches still exist in the DB but are filtered out of the public
 *     grid + search.
 *
 * Some fields are deploy-locked: once the Alpha Vault + Genesis Pass
 * collection are on-chain, certain knobs (supply, mint price, token
 * symbol, vesting params) are committed and cannot be edited even by
 * the creator. We enforce that here, not just in the UI, so a
 * malicious form post can't bypass the rule.
 */

import { revalidatePath } from "next/cache";

import { getWalletSession } from "@/lib/auth/session";
import { isCollectionCreator } from "@/lib/data/store-admin";
import { parseNftGalleryUrlsJson } from "@/lib/launch/nft-gallery";
import { isValidAccentColor, sanitizeProjectPageDoc } from "@/lib/launch/project-page";
import {
  serializeTokenMetadataProfile,
  tokenMetadataProfileFromForm,
  validateTokenMetadataProfile,
} from "@/lib/launch/token-metadata-profile";
import {
  serializeTokenSocialLinks,
  tokenSocialLinksFromForm,
  validateTokenSocialLinks,
} from "@/lib/launch/token-social";
import { createServiceRoleClient } from "@/lib/supabase/server";

const SLUG_RE = /^[a-z0-9-]{3,64}$/;
const MAX_NAME = 96;
const MAX_TAGLINE = 200;
const MAX_DESCRIPTION = 4000;
const MAX_URL = 1024;
const MAX_PHASE = 64;
const MAX_CATEGORY = 32;
const MAX_UTILITY = 64;
const MAX_UTILITIES = 12;

export type LaunchManageState = { ok: boolean; message?: string };
export const launchManageInitialState: LaunchManageState = { ok: false };

function asText(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function clampString(value: string, max: number): string {
  return value.slice(0, max);
}

function clampSliceBPct(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function clampSliceCreatorSharePct(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isHttpsUrl(value: string): boolean {
  if (!value) return false;
  // Allow Supabase Storage public URLs (https://) and any https:// the
  // creator pastes. Reject http:// because Next.js Image rejects insecure
  // remote URLs in production builds.
  return /^https:\/\/.+/.test(value);
}

export async function updateLaunchSettings(
  _prev: LaunchManageState,
  form: FormData,
): Promise<LaunchManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in with your wallet first." };

  const slug = asText(form, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, message: "Bad slug." };
  }

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) {
    return { ok: false, message: "Only the launch creator can edit these settings." };
  }

  const supabase = createServiceRoleClient();

  // Pull the current row so we know which fields are deploy-locked.
  const { data: existing, error: readErr } = await supabase
    .from("collections")
    .select(
      "slug, alpha_vault, core_collection, holder_reward_pct, token_holder_reward_pct, status, quote_asset, slice_b_pct, slice_b_creator_share_pct",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!existing) return { ok: false, message: "Launch not found." };

  const row = existing as {
    alpha_vault: string | null;
    core_collection: string | null;
    quote_asset: string | null;
    slice_b_pct: number | null;
    slice_b_creator_share_pct: number | null;
  };
  const alphaVaultLinked = !!(row.alpha_vault && row.alpha_vault.trim());
  const isOnChain = !!row.core_collection && !!row.alpha_vault;

  // Cosmetic / marketing fields — always editable.
  const name = clampString(asText(form, "name"), MAX_NAME);
  const tagline = clampString(asText(form, "tagline"), MAX_TAGLINE);
  const description = clampString(asText(form, "description"), MAX_DESCRIPTION);
  const bannerUrl = clampString(asText(form, "bannerUrl"), MAX_URL);
  const logoUrl = clampString(asText(form, "logoUrl"), MAX_URL);
  const phase = clampString(asText(form, "phase"), MAX_PHASE);
  const category = clampString(asText(form, "category"), MAX_CATEGORY).toLowerCase();
  const utilities = asText(form, "utilities")
    .split(",")
    .map((u) => clampString(u.trim(), MAX_UTILITY))
    .filter(Boolean)
    .slice(0, MAX_UTILITIES);

  const nftGalleryParsed = parseNftGalleryUrlsJson(asText(form, "nftGalleryUrls") || "[]");
  if (nftGalleryParsed === null) {
    return {
      ok: false,
      message: "Extra artwork must be a JSON array of https image URLs (or clear the list).",
    };
  }
  const tokenSocial = tokenSocialLinksFromForm(form);
  const socialErr = validateTokenSocialLinks(tokenSocial);
  if (socialErr) return { ok: false, message: socialErr };
  const tokenMetaProfileParsed = tokenMetadataProfileFromForm(form);
  if (tokenMetaProfileParsed === null) {
    return { ok: false, message: "Token metadata profile JSON was invalid." };
  }
  const profileErr = validateTokenMetadataProfile(tokenMetaProfileParsed);
  if (profileErr) return { ok: false, message: profileErr };

  if (!name) return { ok: false, message: "Name is required." };
  if (!description) return { ok: false, message: "Description is required." };
  if (!isHttpsUrl(bannerUrl)) return { ok: false, message: "Banner must be an https:// URL." };
  if (!isHttpsUrl(logoUrl)) return { ok: false, message: "Logo must be an https:// URL." };

  // Off-chain economic knobs.
  // holder_reward_pct (0..100) is the % of the creator-fee pot paid to
  // Genesis Pass holders at distribute time. Always editable because
  // it's enforced off-chain at /api/launches/[slug]/distribute.
  const holderRewardPctRaw = asText(form, "holderRewardPct");
  const holderRewardPctNum = Number(holderRewardPctRaw);
  const holderRewardPct = Number.isFinite(holderRewardPctNum)
    ? Math.max(0, Math.min(100, Math.round(holderRewardPctNum)))
    : (existing as { holder_reward_pct: number | null }).holder_reward_pct ?? 50;

  // token_holder_reward_pct (0..100) is the % of every token-reward
  // distribution paid to Genesis Pass holders. Off-chain too.
  const tokenHolderRewardPctRaw = asText(form, "tokenHolderRewardPct");
  const tokenHolderRewardPctNum = Number(tokenHolderRewardPctRaw);
  const tokenHolderRewardPct = Number.isFinite(tokenHolderRewardPctNum)
    ? Math.max(0, Math.min(100, Math.round(tokenHolderRewardPctNum)))
    : (existing as { token_holder_reward_pct: number | null }).token_holder_reward_pct ?? 0;

  type UpdatePayload = {
    name: string;
    tagline: string;
    description: string;
    banner_url: string;
    logo_url: string;
    phase: string;
    utilities: string[];
    holder_reward_pct: number;
    /** Mirrors holder split as bps for on-chain deploy intent. */
    nft_holder_share_bps: number;
    token_holder_reward_pct: number;
    category: string | null;
    nft_gallery_urls: string[];
    token_social_links: ReturnType<typeof serializeTokenSocialLinks>;
    token_metadata_profile: ReturnType<typeof serializeTokenMetadataProfile>;
  };
  const update: UpdatePayload = {
    name,
    tagline,
    description,
    banner_url: bannerUrl,
    logo_url: logoUrl,
    phase: phase || "Public mint",
    utilities,
    holder_reward_pct: holderRewardPct,
    nft_holder_share_bps: Math.min(10_000, Math.max(0, holderRewardPct * 100)),
    token_holder_reward_pct: tokenHolderRewardPct,
    category: category || null,
    nft_gallery_urls: nftGalleryParsed,
    token_social_links: serializeTokenSocialLinks(tokenSocial),
    token_metadata_profile: serializeTokenMetadataProfile(tokenMetaProfileParsed),
  };

  // Deploy-locked guards. Even though the form hides these inputs once
  // the launch is on-chain, we verify here too so a hand-crafted POST
  // can't bypass the lock.
  if (!isOnChain && !alphaVaultLinked) {
    const sliceBPctFallback = clampSliceBPct(Number(row.slice_b_pct ?? 0), 0);
    const sliceBCreatorFallback = clampSliceCreatorSharePct(Number(row.slice_b_creator_share_pct ?? 50), 50);
    const tokenSymbolRaw = asText(form, "tokenSymbol").toUpperCase();
    if (tokenSymbolRaw && /^[A-Z0-9]{2,10}$/.test(tokenSymbolRaw)) {
      (update as Record<string, unknown>).token_symbol = tokenSymbolRaw;
    }
    (update as Record<string, unknown>).quote_asset =
      asText(form, "quoteAsset").toUpperCase() === "USDC" ? "USDC" : "SOL";
    (update as Record<string, unknown>).slice_b_pct = clampSliceBPct(
      Number(asText(form, "sliceBPct")),
      sliceBPctFallback,
    );
    (update as Record<string, unknown>).slice_b_creator_share_pct = clampSliceCreatorSharePct(
      Number(asText(form, "sliceBCreatorSharePct")),
      sliceBCreatorFallback,
    );
  }

  const { error: writeErr } = await supabase.from("collections").update(update).eq("slug", slug);
  if (writeErr) return { ok: false, message: writeErr.message };

  // Bust every page that renders this launch.
  revalidatePath("/");
  revalidatePath(`/project/${slug}`);
  revalidatePath(`/project/${slug}/manage`);
  revalidatePath(`/project/${slug}/store`);
  revalidatePath(`/launch/${slug}`);
  revalidatePath(`/mint/${slug}`);
  revalidatePath(`/creator/${session.address}`);
  revalidatePath("/dashboard");

  return { ok: true, message: "Saved. Public pages will refresh shortly." };
}

/**
 * Update the project-page document + theme settings for a launch.
 *
 * Body comes from the page-editor as a single JSON-encoded form field
 * (`payload`). We sanitize the doc through `sanitizeProjectPageDoc` so
 * arbitrary JSON in the form body can never persist invalid block
 * shapes or unsafe URLs.
 *
 * Theme fields (accent color, hero layout, headline overrides) are
 * stored as flat columns alongside the JSONB doc.
 */
export async function updateProjectPage(
  _prev: LaunchManageState,
  form: FormData,
): Promise<LaunchManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in with your wallet first." };

  const slug = asText(form, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) return { ok: false, message: "Bad slug." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "Only the launch creator can edit the page." };

  const payloadRaw = asText(form, "payload");
  let payload: unknown;
  try {
    payload = payloadRaw ? JSON.parse(payloadRaw) : {};
  } catch {
    return { ok: false, message: "Page payload was not valid JSON." };
  }

  const doc = sanitizeProjectPageDoc(payload);

  const accentColorRaw = asText(form, "accentColor");
  const accentColor =
    accentColorRaw && isValidAccentColor(accentColorRaw) ? accentColorRaw : null;

  const heroLayoutRaw = asText(form, "heroLayout");
  const heroLayout =
    heroLayoutRaw === "minimal" || heroLayoutRaw === "split" || heroLayoutRaw === "classic"
      ? heroLayoutRaw
      : null;

  const projectHeadline = clampString(asText(form, "projectHeadline"), 200) || null;
  const projectSubhead = clampString(asText(form, "projectSubhead"), 400) || null;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("collections")
    .update({
      project_page: doc,
      accent_color: accentColor,
      hero_layout: heroLayout,
      project_headline: projectHeadline,
      project_subhead: projectSubhead,
    })
    .eq("slug", slug);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/project/${slug}`);
  revalidatePath(`/project/${slug}/manage`);
  revalidatePath(`/project/${slug}/manage/page-editor`);

  return {
    ok: true,
    message: `Saved · ${doc?.blocks.length ?? 0} block${doc?.blocks.length === 1 ? "" : "s"}.`,
  };
}

export async function setLaunchPublished(
  _prev: LaunchManageState,
  form: FormData,
): Promise<LaunchManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in first." };

  const slug = asText(form, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) return { ok: false, message: "Bad slug." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "Not allowed." };

  const isPublished = asText(form, "isPublished") === "true";

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("collections")
    .update({ is_published: isPublished })
    .eq("slug", slug);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  revalidatePath(`/project/${slug}`);
  revalidatePath(`/project/${slug}/manage`);
  revalidatePath(`/launch/${slug}`);
  revalidatePath(`/dashboard`);
  revalidatePath(`/creator/${session.address}`);

  return {
    ok: true,
    message: isPublished
      ? "Launch is published — visible on the home grid and discovery feed."
      : "Launch hidden from public listings (data is preserved).",
  };
}
