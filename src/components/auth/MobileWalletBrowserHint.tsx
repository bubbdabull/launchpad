"use client";

import { useCallback, useEffect, useState } from "react";

import { detectMobileInAppBrowserHint } from "@/lib/browser/in-app-browser";

const STORAGE_KEY = "lp_dismiss_mobile_browser_hint_v1";

/**
 * When the site runs inside an in-app WebView (social apps, Android WebView,
 * some wallet browsers), Privy + wallet state may not match Safari/Chrome.
 * Prompt users to open the same URL in the system browser and offer copy.
 */
export function MobileWalletBrowserHint() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const hint = detectMobileInAppBrowserHint(navigator.userAgent);
    setVisible(hint !== null);
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, []);

  const copyLink = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Browser tip for wallet connection"
      className="sticky top-0 z-[100] border-b border-amber-400/35 bg-amber-950/95 px-3 py-2.5 text-center text-[12px] leading-snug text-amber-50 shadow-md backdrop-blur-sm sm:text-[13px]"
    >
      <p className="mx-auto max-w-2xl">
        You might be inside another app&apos;s browser. Open this same page in{" "}
        <span className="font-semibold text-white">Safari</span> or{" "}
        <span className="font-semibold text-white">Chrome</span> so your wallet works normally—use the menu, or copy the
        link below.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="rounded-full border border-amber-300/50 bg-amber-400/15 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-400/25"
        >
          {copied ? "Copied" : "Copy page link"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-amber-100/85 hover:border-white/30"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
