/**
 * Public Supabase settings (safe for browser + Edge proxy).
 * Prefer legacy anon key; new projects may use the publishable key instead.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url?.trim() || !anonKey?.trim()) return null;
  return { url: url.trim(), anonKey: anonKey.trim() };
}

/** Server-only Supabase credentials for privileged actions (never expose to client). */
export function getSupabaseServiceRoleConfig(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !serviceRoleKey?.trim()) return null;
  return { url: url.trim(), serviceRoleKey: serviceRoleKey.trim() };
}
