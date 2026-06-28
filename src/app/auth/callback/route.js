import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Clamp ?next= to a same-origin path to avoid open-redirects.
function safeNext(raw) {
  if (!raw || typeof raw !== 'string') return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  // WHATWG URL parsing normalizes '\' to '/', so '/\evil.com' would escape the
  // origin just like '//evil.com'. Reject backslashes and control chars.
  if (/[\\\x00-\x1f]/.test(raw)) return '/'
  return raw
}

// Build a redirect back to /login carrying an error code (and optional detail).
function loginRedirect(origin, params) {
  const url = new URL('/login', origin)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url)
}

// GET /auth/callback — the OAuth (Google) redirect target.
//
// Supabase sends the user back here with a one-time `?code` after they consent.
// We exchange that code for a session and — crucially — bind Supabase's cookie
// writes to the redirect *response* we return, so the freshly-minted session
// cookies actually reach the browser. (The shared createClient() writes to the
// next/headers store and swallows failures, which does NOT reliably attach
// cookies to a hand-built redirect; proxy.js sets cookies on its response for
// the same reason.)
//
// We then enforce the same provisioning rule as getUser(): an authenticated
// Google identity that isn't registered in biz_users is signed out and bounced
// to /login rather than handed a usable session.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // The provider can redirect back with an error instead of a code (e.g. the
  // user denied consent).
  const oauthError =
    searchParams.get('error_description') || searchParams.get('error')

  if (!code) {
    return loginRedirect(origin, { error: 'auth_failed', detail: oauthError })
  }

  const cookieStore = await cookies()

  // Post-login destination: the login page stashes it in mba_oauth_next so the
  // OAuth redirectTo can stay query-free (see LoginClient). Fall back to a
  // legacy ?next= and finally to '/'.
  const rawNext =
    cookieStore.get('mba_oauth_next')?.value || searchParams.get('next') || ''
  const next = safeNext(rawNext ? decodeURIComponent(rawNext) : '/')

  // The happy-path response. Supabase writes the session cookies onto THIS
  // object via setAll below, so they ride along with the redirect to `next`.
  const response = NextResponse.redirect(new URL(next, origin))
  // The destination cookie has done its job — expire it.
  response.cookies.set('mba_oauth_next', '', { path: '/', maxAge: 0 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          // Includes the PKCE code-verifier cookie set by the browser client,
          // which exchangeCodeForSession needs to read.
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return loginRedirect(origin, { error: 'auth_failed', detail: error.message })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auto-link pre-provisioned users: an admin may have created the biz_users
  // row (with role + facility) before this person ever signed in, leaving
  // auth_id NULL. Claim that row for this auth identity BEFORE the existence
  // check below — biz_users RLS is scoped to the caller's auth_id, so until the
  // row is linked the email lookup can't see it and the user reads as "not
  // registered". link_auth_user is SECURITY DEFINER (bypasses RLS), idempotent,
  // and only fills a NULL auth_id matched by email. Best-effort: if the DB
  // function isn't present yet we don't block login.
  if (user?.email) {
    try {
      await supabase.rpc('link_auth_user', {
        p_auth_id: user.id,
        p_email: user.email,
      })
    } catch {
      // Network/transient failure — linking is best-effort; don't block login.
    }
  }

  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('id')
    // Escape ILIKE wildcards so the email matches literally, not as a pattern.
    .ilike('email', (user?.email || '').replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()

  if (!bizUser) {
    // Authenticated to Supabase but not provisioned — drop the session and
    // surface the "not registered" message on the login page.
    await supabase.auth.signOut()
    return loginRedirect(origin, {
      error: 'user_not_found',
      email: user?.email,
    })
  }

  return response
}
