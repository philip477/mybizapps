import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client — SERVER ONLY.
//
// This bypasses RLS, so it must never be imported into a Client Component or
// shipped to the browser. It's used by the /api/upload route to provision
// storage buckets and write objects on behalf of a verified master_control
// operator (the route does its own auth + role check before touching this).
//
// Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured so callers can
// surface a clear "upload not configured" error instead of crashing.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
