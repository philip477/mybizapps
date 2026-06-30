import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Proxy — Next.js 16's renamed Middleware (same functionality, nodejs runtime).
// Refreshes the Supabase session on every request, bounces unauthed users to
// /login, and keeps master_control accounts confined to the Master Control area.
// Geofencing is intentionally omitted for now.
export async function proxy(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the token server-side and, as a side effect, refreshes
  // the session cookies via setAll above.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Public routes that do NOT require authentication. "/" serves the marketing
  // landing page to unauthenticated visitors (page.js decides app-vs-marketing),
  // so it must NOT be bounced to /login.
  const isPublic = path === '/' || path === '/price-sheet'

  if (!user) {
    // OAuth resilience: the provider should land the user on /auth/callback,
    // but if Supabase's Redirect-URLs allowlist doesn't match (it then silently
    // falls back to the Site URL), they arrive on a normal route — typically "/"
    // — still carrying the one-time ?code, and nothing ever exchanges it (the
    // user is stuck on the marketing page). Forward any such stray code to the
    // callback so it always gets exchanged for a session. Scoped to
    // unauthenticated requests so it can't hijack app routes that use ?code.
    // (/auth/* is excluded from this proxy's matcher, so the real callback is
    // never double-handled.) This mirrors the code-exchange guard in the
    // myltcapps middleware.
    const oauthCode = request.nextUrl.searchParams.get('code')
    if (oauthCode) {
      const callbackUrl = new URL('/auth/callback', request.url)
      // Carry the whole query (code + any provider error/next) to the callback.
      callbackUrl.search = request.nextUrl.search
      return NextResponse.redirect(callbackUrl)
    }

    // Let unauthenticated visitors reach public routes; the session-refresh side
    // effect above has already run, so we just pass the request through.
    if (isPublic) return response

    const loginUrl = new URL('/login', request.url)
    // Preserve the full path + query so email deep links survive the round-trip.
    loginUrl.searchParams.set('next', path + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // ── Role-area gating ──
  // master_control accounts may only reach the Master Control area, /my-account,
  // and the home page. Everyone else passes through.
  const isMasterArea = path.startsWith('/master-control')

  const { data: me } = await supabase
    .from('biz_users')
    .select('user_role')
    // Escape ILIKE wildcards so the email is matched literally, not as a pattern.
    .ilike('email', (user.email || '').replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()
  const role = me?.user_role ?? null

  if (role === 'master_control') {
    const allowed =
      isMasterArea || path === '/' || path.startsWith('/my-account')
    if (!allowed) {
      return NextResponse.redirect(new URL('/master-control', request.url))
    }
  } else if (isMasterArea) {
    // Non-master_control users can't enter the Master Control area.
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Run on all routes EXCEPT:
     * - /login (auth page)
     * - /signup (self-serve account creation — public, like /login)
     * - /auth (OAuth callback — exchanges the code itself, sets the session)
     * - /api (API routes handle their own auth)
     * - /_next/static, /_next/image (Next internals)
     * - favicon / manifest / static image assets
     */
    '/((?!login|signup|auth|api|_next/static|_next/image|favicon\\.ico|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|manifest\\.json|images).*)',
  ],
}
