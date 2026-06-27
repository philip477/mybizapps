import { createBrowserClient } from '@supabase/ssr'

// Browser Supabase client — used by Client Components.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
