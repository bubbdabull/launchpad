import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

/**
 * Browserless Supabase client (anon key) for route handlers called by wallets
 * and indexers — no cookies/session.
 */
export function createPublicSupabaseClient() {
  const c = getSupabasePublicConfig();
  if (!c) return null;
  return createClient(c.url, c.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
