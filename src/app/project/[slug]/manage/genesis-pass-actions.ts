"use server";

import { revalidatePath } from "next/cache";

import { getWalletSession } from "@/lib/auth/session";
import { getPublicAppOrigin } from "@/lib/app/public-app-origin";
import { isCollectionCreator } from "@/lib/data/store-admin";
import { isCollectionAssetPublicUrl } from "@/lib/images/is-collection-asset-public-url";
import { assertTraitCollectionConfig } from "@/lib/nft-generation/config-loader";
import {
  buildGenesisBuiltinTraitConfig,
  GENESIS_TRAIT_PRESET_STARTER,
  isGenesisBuiltinTraitPresetId,
} from "@/lib/nft-generation/presets/built-in-genesis-presets";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { GenesisPassNftConfig } from "@/types/genesis-pass-nft";

export type GenesisPassManageState = { ok: boolean; message?: string };
export const genesisPassManageInitialState: GenesisPassManageState = { ok: false };

const SLUG_RE = /^[a-z0-9-]{3,64}$/;

function asText(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function isHttpsUrl(value: string): boolean {
  return /^https:\/\/.+/i.test(value);
}

function parseExisting(raw: unknown): GenesisPassNftConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: GenesisPassNftConfig = {};
  if (typeof o.revealAt === "string" && o.revealAt.trim()) out.revealAt = o.revealAt.trim();
  if (typeof o.placeholderImageUrl === "string" && o.placeholderImageUrl.trim()) {
    out.placeholderImageUrl = o.placeholderImageUrl.trim();
  }
  if (typeof o.traitConfigUri === "string" && o.traitConfigUri.trim()) {
    out.traitConfigUri = o.traitConfigUri.trim();
  }
  if (typeof o.rarityListingUrl === "string" && o.rarityListingUrl.trim()) {
    out.rarityListingUrl = o.rarityListingUrl.trim();
  }
  if (typeof o.allowDynamicPostReveal === "boolean") out.allowDynamicPostReveal = o.allowDynamicPostReveal;
  if (o.traitConfig != null && typeof o.traitConfig === "object" && !Array.isArray(o.traitConfig)) {
    try {
      out.traitConfig = assertTraitCollectionConfig(o.traitConfig);
    } catch {
      /* drop invalid inline config */
    }
  }
  return out;
}

/**
 * Creator-only: update `collections.genesis_pass_config` (generative art + reveal — cosmetic / L2 mirror).
 */
export async function updateGenesisPassNftConfig(
  _prev: GenesisPassManageState,
  form: FormData,
): Promise<GenesisPassManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in with your wallet first." };

  const slug = asText(form, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) return { ok: false, message: "Bad slug." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "Only the launch creator can edit this." };

  const supabase = createServiceRoleClient();
  const { data: row, error: readErr } = await supabase
    .from("collections")
    .select("genesis_pass_config")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "Launch not found." };

  if (asText(form, "clearGenesisPass") === "1") {
    const { error } = await supabase.from("collections").update({ genesis_pass_config: null }).eq("slug", slug);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/project/${slug}/manage`);
    revalidatePath(`/mint/${slug}`);
    revalidatePath(`/launch/${slug}`);
    return { ok: true, message: "Generative Genesis Pass settings cleared." };
  }

  const base = parseExisting((row as { genesis_pass_config?: unknown }).genesis_pass_config);
  const next: GenesisPassNftConfig = { ...base };

  const revealLocal = asText(form, "revealAtLocal");
  if (asText(form, "clearRevealAt") === "1" || !revealLocal) {
    delete next.revealAt;
  } else {
    const d = new Date(revealLocal);
    if (!Number.isFinite(d.getTime())) {
      return { ok: false, message: "Reveal time is not a valid date." };
    }
    next.revealAt = d.toISOString();
  }

  const placeholder = asText(form, "placeholderImageUrl");
  if (!placeholder) delete next.placeholderImageUrl;
  else if (!isHttpsUrl(placeholder) || !isCollectionAssetPublicUrl(placeholder)) {
    return {
      ok: false,
      message: "Placeholder must be an image uploaded on this site (use the upload button).",
    };
  } else next.placeholderImageUrl = placeholder;

  const rarityListing = asText(form, "rarityListingUrl");
  if (!rarityListing) delete next.rarityListingUrl;
  else if (!isHttpsUrl(rarityListing)) {
    return { ok: false, message: "Rarity listing URL must be https." };
  } else next.rarityListingUrl = rarityListing;

  if (asText(form, "allowDynamicPostReveal") === "1") next.allowDynamicPostReveal = true;
  else delete next.allowDynamicPostReveal;

  const traitUri = asText(form, "traitConfigUri");
  const advanced = asText(form, "traitConfigJson");
  const applyPresetId = asText(form, "applyGenesisTraitPreset");
  const legacyStarter = asText(form, "applyStarterTraitPreset") === "1";
  const presetToApply =
    applyPresetId && isGenesisBuiltinTraitPresetId(applyPresetId)
      ? applyPresetId
      : legacyStarter
        ? GENESIS_TRAIT_PRESET_STARTER
        : "";

  if (presetToApply) {
    const origin = await getPublicAppOrigin();
    if (!origin) {
      return {
        ok: false,
        message:
          "Built-in presets need this app’s public web address to build image links. Use custom trait JSON for now, or ask whoever deploys this app to set its canonical site URL.",
      };
    }
    next.traitConfig = buildGenesisBuiltinTraitConfig(presetToApply, origin);
    delete next.traitConfigUri;
  } else if (advanced) {
    try {
      const parsed = JSON.parse(advanced) as unknown;
      next.traitConfig = assertTraitCollectionConfig(parsed);
      delete next.traitConfigUri;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid JSON.";
      return { ok: false, message: `Trait config JSON: ${msg}` };
    }
  } else if (asText(form, "clearInlineTraitConfig") === "1") {
    delete next.traitConfig;
  }

  if (next.traitConfig) {
    delete next.traitConfigUri;
  } else {
    if (!traitUri) delete next.traitConfigUri;
    else if (!isHttpsUrl(traitUri)) {
      return { ok: false, message: "Trait config URL must be https." };
    } else next.traitConfigUri = traitUri;
  }

  if (
    !next.revealAt &&
    !next.placeholderImageUrl &&
    !next.traitConfigUri &&
    !next.traitConfig &&
    !next.rarityListingUrl &&
    !next.allowDynamicPostReveal
  ) {
    const { error } = await supabase.from("collections").update({ genesis_pass_config: null }).eq("slug", slug);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase.from("collections").update({ genesis_pass_config: next }).eq("slug", slug);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/project/${slug}/manage`);
  revalidatePath(`/mint/${slug}`);
  revalidatePath(`/launch/${slug}`);
  return { ok: true, message: "Genesis Pass NFT settings saved." };
}
