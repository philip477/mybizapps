import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import BusinessAdminClient from './BusinessAdminClient'

export const dynamic = 'force-dynamic'

// Business Control — the super_user admin hub. Lists the facility-admin tools
// (App Config, Assign Company Apps, …). These are `Admin Only` apps in
// biz_apps; if none have been seeded yet we fall back to the built-in set so
// the hub is never empty.
//
// Admin access is super_user-only here. master_control is confined to the
// Master Control area by proxy.js; regular users are bounced home.
const FALLBACK_ADMIN_APPS = [
  { id: 'app-config', app_name: 'App Config', app_link: '/admin/app-config', app_icon: '⚙️' },
  { id: 'assign-apps', app_name: 'Assign Company Apps', app_link: '/admin/assign-apps', app_icon: '🧩' },
]

export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()

  const { data: adminApps } = await supabase
    .from('biz_apps')
    .select('id, app_name, app_link, app_icon, app_icon_emoji, active, app_type')
    .eq('app_type', 'Admin Only')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('app_name', { ascending: true })

  const apps = adminApps && adminApps.length > 0 ? adminApps : FALLBACK_ADMIN_APPS

  return <BusinessAdminClient apps={apps} />
}
