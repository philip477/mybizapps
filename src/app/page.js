import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import HomeClient from './HomeClient'

// Home — server component. Auth is enforced by proxy.js, but we re-check here
// and resolve the per-user navigation server-side, then hand a plain payload to
// the client tile renderer.
export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // App-level profile.
  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('*')
    .ilike('useremail', authUser.email)
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
  const APP_SELECT = 'id, app_name, app_icon, app_link, app_active'
  let navItems = []

  if (fid) {
    const { data: perms } = await supabase
      .from('biz_app_permission_mains')
      .select(`app_order, biz_apps(${APP_SELECT})`)
      .eq('facility_id', fid)
      .order('app_order')

    navItems = (perms || [])
      .map((p) => (Array.isArray(p.biz_apps) ? p.biz_apps[0] : p.biz_apps))
      .filter((a) => a && a.app_active)
  }

  if (navItems.length === 0) {
    const { data: allApps } = await supabase
      .from('biz_apps')
      .select(APP_SELECT)
      .eq('app_active', true)
      .order('app_name')
    navItems = allApps || []
  }

  const user = {
    id: bizUser.id,
    email: bizUser.useremail,
    full_name: bizUser.full_name,
    first_name: bizUser.first_name,
    role: bizUser.user_role,
    facility_id: fid,
  }

  return <HomeClient user={user} facility={facility} navItems={navItems} />
}
