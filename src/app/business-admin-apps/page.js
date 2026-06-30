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
  { id: 'company-config', app_name: 'Business Config', app_link: '/admin/company-config', app_icon: '🏢' },
  { id: 'assign-apps', app_name: 'Assign Company Apps', app_link: '/admin/assign-apps', app_icon: '🧩' },
  { id: 'modules', app_name: 'Manage Modules', app_link: '/admin/modules', app_icon: '📦' },
  { id: 'services', app_name: 'Manage Services', app_link: '/admin/services', app_icon: '🛠️' },
]

// Built-in admin tools that have no biz_apps catalog row yet but should always
// appear in the hub, keyed by app_link. (Accept Payments lives inside Company
// Config now, so it isn't surfaced at the hub's top level.)
const BUILTIN_ADMIN_APPS = [
  { id: 'company-config', app_name: 'Company Config', app_link: '/admin/company-config', app_icon: null, app_icon_emoji: '🏢' },
  { id: 'manage-modules', app_name: 'Manage Modules', app_link: '/admin/modules', app_icon: null, app_icon_emoji: '📦' },
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

  const apps = adminApps && adminApps.length > 0 ? [...adminApps] : [...FALLBACK_ADMIN_APPS]

  // Ensure built-in tools (no catalog row yet) always appear in the hub.
  for (const builtin of BUILTIN_ADMIN_APPS) {
    if (!apps.some((a) => a.app_link === builtin.app_link)) apps.push(builtin)
  }

  return <BusinessAdminClient apps={apps} />
}
