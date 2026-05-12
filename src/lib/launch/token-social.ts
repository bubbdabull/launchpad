/** Off-chain token / launch social links persisted on `collections.token_social_links`. */
export type TokenSocialLinks = {
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
};

const KEYS = ["website", "twitter", "discord", "telegram"] as const;

export function emptyTokenSocialLinks(): TokenSocialLinks {
  return {};
}

export function parseTokenSocialLinksJson(raw: string | null | undefined): TokenSocialLinks | null {
  if (raw == null || raw === "") return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const out: TokenSocialLinks = {};
    for (const k of KEYS) {
      const s = (v as Record<string, unknown>)[k];
      if (typeof s === "string" && s.trim()) out[k] = s.trim();
    }
    return out;
  } catch {
    return null;
  }
}

export function tokenSocialLinksFromForm(form: FormData): TokenSocialLinks {
  const website = String(form.get("socialWebsite") ?? "").trim();
  const twitter = String(form.get("socialTwitter") ?? "").trim();
  const discord = String(form.get("socialDiscord") ?? "").trim();
  const telegram = String(form.get("socialTelegram") ?? "").trim();
  const out: TokenSocialLinks = {};
  if (website) out.website = website;
  if (twitter) out.twitter = twitter;
  if (discord) out.discord = discord;
  if (telegram) out.telegram = telegram;
  return out;
}

export function serializeTokenSocialLinks(links: TokenSocialLinks): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of KEYS) {
    const v = links[k];
    if (v?.trim()) o[k] = v.trim();
  }
  return o;
}

export function validateTokenSocialLinks(links: TokenSocialLinks): string | null {
  for (const k of KEYS) {
    const u = links[k];
    if (!u) continue;
    if (u.length > 2048) return `${k} link is too long (max 2048 characters).`;
    if (!/^https:\/\/.+/i.test(u)) return `${k} must be a full https:// URL.`;
  }
  return null;
}
