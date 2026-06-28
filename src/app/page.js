import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import HomeClient from './HomeClient'
import MarketingPage from './MarketingPage'

// Home — server component. "/" is public: authenticated users get the app home
// (HomeClient), while unauthenticated visitors get the marketing landing page.
// proxy.js deliberately lets unauthenticated requests reach "/", so the auth
// branch is decided here rather than via a redirect.
export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  // The marketing landing page is shown ONLY when there is no auth session at
  // all. Anyone holding a valid session gets the app home below — even if their
  // biz_users profile lookup fails (missing row, RLS, transient error). We must
  // never bounce an authenticated user back to marketing/login from here.
  if (!authUser) return <MarketingPage />

  // App-level profile. A null result is tolerated: we fall back to a minimal
  // profile derived from the auth user so the app home still renders.
  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('*')
    .ilike('email', authUser.email)
    .maybeSingle()

  // master_control operators get the Master Control dashboard, not the regular
  // facility app launcher. (proxy.js already confines them to /master-control,
  // /my-account and "/", so this is the only place "/" needs to branch.)
  if (bizUser?.user_role === 'master_control') {
    redirect('/master-control')
  }

  const fid = bizUser?.facility_id ?? null

  // Facility (for the header logo + name). `facilities` has no biz_ prefix.
  const { data: facility } = fid
    ? await supabase
        .from('facilities')
        .select('id, company_name, company_logo')
        .eq('id', fid)
        .maybeSingle()
    : { data: null }

  // Nav items: the facility's configured app set (biz_app_permission_mains
  // joined to biz_apps), ordered by app_order. Falls back to ALL active
  // biz_apps when no permission_mains exist yet (fresh facility).
  const APP_SELECT = 'id, app_name, app_icon, app_icon_emoji, app_link, active'
  let navItems = []

  if (fid) {
    const { data: perms } = await supabase
      .from('biz_app_permission_mains')
      .select(`app_order, biz_apps(${APP_SELECT})`)
      .eq('facility_id', fid)
      .order('app_order')

    navItems = (perms || [])
      .map((p) => (Array.isArray(p.biz_apps) ? p.biz_apps[0] : p.biz_apps))
      .filter((a) => a && a.active)
  }

  if (navItems.length === 0) {
    const { data: allApps } = await supabase
      .from('biz_apps')
      .select(APP_SELECT)
      .eq('active', true)
      .order('app_name')
    navItems = allApps || []
  }

  const user = {
    id: bizUser?.id ?? authUser.id,
    email: bizUser?.email ?? authUser.email,
    full_name: `${bizUser?.first_name || ''} ${bizUser?.last_name || ''}`.trim(),
    first_name: bizUser?.first_name ?? null,
    last_name: bizUser?.last_name ?? null,
    role: bizUser?.user_role ?? 'user',
    facility_id: fid,
  }

  return <HomeClient user={user} facility={facility} navItems={navItems} />
}
