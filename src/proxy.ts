import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  sanitizeReferrerWallet,
} from "@/lib/referrals/cookie";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

/**
 * Refreshes Supabase Auth cookies so Server Components see a valid session.
 * No-op when Supabase env is not configured (local dev without backend).
 *
 * Also captures `?ref=<wallet>` referral params and pins them to a 90-day
 * `lp_ref` cookie. We deliberately don't overwrite an existing cookie —
 * first-touch wins. That keeps incentives clean: the wallet that brought
 * a user in gets credited, not whatever URL they last clicked.
 */
export async function proxy(request: NextRequest) {
  // 1) Referral capture. Runs unconditionally so we credit referrers even
  //    if Supabase isn't configured locally.
  const refParam = request.nextUrl.searchParams.get("ref");
  const refExisting = request.cookies.get(REFERRAL_COOKIE)?.value;
  const sanitizedNew = sanitizeReferrerWallet(refParam);
  const shouldSetReferralCookie = !!sanitizedNew && !refExisting;

  const config = getSupabasePublicConfig();
  if (!config) {
    const res = NextResponse.next({ request });
    if (shouldSetReferralCookie) {
      res.cookies.set(REFERRAL_COOKIE, sanitizedNew, {
        path: "/",
        maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  await supabase.auth.getUser();

  if (shouldSetReferralCookie) {
    supabaseResponse.cookies.set(REFERRAL_COOKIE, sanitizedNew, {
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
