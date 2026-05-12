"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

/** Supabase client for Client Components (browser). */
export function createClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }
  return createBrowserClient(config.url, config.anonKey);
}
