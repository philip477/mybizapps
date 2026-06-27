import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server Supabase client — reads/writes the Next.js cookie store.
// In Next.js 16 `cookies()` is async and must be awaited.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // In a Server Component the cookie store is read-only and throws on
          // set — the proxy handles the session refresh, so swallow it here.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
