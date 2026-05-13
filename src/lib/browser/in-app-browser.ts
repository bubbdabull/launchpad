/**
 * Detect embedded / in-app browsers where wallet + Privy sessions often
 * behave differently from Safari / Chrome (separate storage, no handoff).
 */

export type InAppBrowserHint = "social-or-webview" | null;

/** UA substring checks — keep conservative to avoid annoying real browsers. */
export function detectMobileInAppBrowserHint(userAgent: string | undefined): InAppBrowserHint {
  if (!userAgent) return null;
  const ua = userAgent;
  const u = ua.toLowerCase();

  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  if (!isMobile) return null;

  // Android System WebView (many in-app browsers, including some wallet flows)
  if (u.includes("; wv)") || u.includes("webview")) return "social-or-webview";

  // Social / messenger in-app browsers
  if (
    u.includes("instagram") ||
    u.includes("fban") ||
    u.includes("fbav") ||
    u.includes("fb_iab") ||
    u.includes(" line/") ||
    u.includes("linkedinapp") ||
    u.includes("micromessenger") ||
    u.includes("snapchat") ||
    u.includes("tiktok") ||
    (u.includes("twitter") && u.includes("twitterandroid"))
  ) {
    return "social-or-webview";
  }

  return null;
}
