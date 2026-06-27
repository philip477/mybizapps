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

  if (!user) {
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
    .ilike('useremail', user.email)
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
     * - /api (API routes handle their own auth)
     * - /_next/static, /_next/image (Next internals)
     * - favicon / manifest / static image assets
     */
    '/((?!login|api|_next/static|_next/image|favicon\\.ico|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|manifest\\.json|images).*)',
  ],
}
