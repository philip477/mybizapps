import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Clamp ?next= to a same-origin path to avoid open-redirects.
function safeNext(raw) {
  if (!raw || typeof raw !== 'string') return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

// GET /auth/callback — the OAuth (Google) redirect target.
//
// Supabase sends the user back here with a one-time `?code` after they consent.
// We exchange that code for a session — the server client writes the auth cookies
// onto the redirect response — then enforce the same provisioning rule as
// getUser(): an authenticated Google identity that isn't registered in biz_users
// must NOT keep a usable session.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  // The provider may redirect back with an error instead of a code (e.g. the
  // user denied consent).
  const oauthError =
    searchParams.get('error_description') || searchParams.get('error')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: bizUser } = await supabase
        .from('biz_users')
        .select('id')
        .ilike('email', user?.email || '')
        .maybeSingle()

      if (!bizUser) {
        // Signed in to Supabase but not provisioned — drop the session and
        // surface the "not registered" message on the login page.
        await supabase.auth.signOut()
        const url = new URL('/login', origin)
        url.searchParams.set('error', 'user_not_found')
        if (user?.email) url.searchParams.set('email', user.email)
        return NextResponse.redirect(url)
      }

      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // No code, or the exchange failed → back to login with a generic error.
  const url = new URL('/login', origin)
  url.searchParams.set('error', 'auth_failed')
  if (oauthError) url.searchParams.set('detail', oauthError)
  return NextResponse.redirect(url)
}
