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
  if (!authUser) return <MarketingPage />

  // App-level profile.
  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('*')
    .ilike('email', authUser.email)
    .maybeSingle()

  if (!bizUser) {
    redirect(`/login?error=user_not_found&email=${encodeURIComponent(authUser.email)}`)
  }

  const fid = bizUser.facility_id

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
  const APP_SELECT = 'id, app_name, app_icon, app_link, active'
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
    id: bizUser.id,
    email: bizUser.email,
    full_name: `${bizUser.first_name || ''} ${bizUser.last_name || ''}`.trim(),
    first_name: bizUser.first_name,
    last_name: bizUser.last_name,
    role: bizUser.user_role,
    facility_id: fid,
  }

  return <HomeClient user={user} facility={facility} navItems={navItems} />
}
