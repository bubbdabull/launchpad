import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabasePublicConfig, getSupabaseServiceRoleConfig } from "@/lib/supabase/env";

/** Supabase client for Server Components, Route Handlers, and Server Actions. */
export async function createClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always set cookies; proxy refreshes the session.
        }
      },
    },
  });
}

/** Server-only privileged client for admin tasks and wallet-auth writes. */
export function createServiceRoleClient() {
  const config = getSupabaseServiceRoleConfig();
  if (!config) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in environment; required for privileged writes.",
    );
  }

  return createSupabaseClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
