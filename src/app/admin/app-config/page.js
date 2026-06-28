import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import AppConfigClient from './AppConfigClient'

export const dynamic = 'force-dynamic'

// App Config — super_user surface for configuring per-facility app settings.
//
// Settings live in biz_app_config as free-form key/value pairs scoped by
// (facility_id, app_id, config_key). The classic use is an `*_admin_group`
// key that names which biz_group administers an app — there is no role bypass,
// so admin access is always group-driven. Keys ending in `_group` get a group
// picker; everything else is a plain text value.
//
// Only super_users reach this page. master_control is confined to the Master
// Control area by proxy.js, and regular users are bounced home below.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()
  const fid = user.facility_id

  const [{ data: appMeta }, { data: perms }, { data: config }, { data: groups }] =
    await Promise.all([
      supabase
        .from('biz_apps')
        .select('app_name, app_icon, app_icon_emoji')
        .eq('app_link', '/admin/app-config')
        .maybeSingle(),
      // The facility's assigned apps (the ones worth configuring), ordered the
      // same way they appear on the home launcher.
      fid
        ? supabase
            .from('biz_app_permission_mains')
            .select('app_order, biz_apps(id, app_name, app_icon, app_icon_emoji, app_link, app_type)')
            .eq('facility_id', fid)
            .order('app_order')
        : Promise.resolve({ data: [] }),
      fid
        ? supabase
            .from('biz_app_config')
            .select('id, app_id, config_key, config_value')
            .eq('facility_id', fid)
        : Promise.resolve({ data: [] }),
      fid
        ? supabase
            .from('biz_groups')
            .select('id, name')
            .eq('facility_id', fid)
            .eq('active', true)
            .order('name')
        : Promise.resolve({ data: [] }),
    ])

  // Flatten the permission join down to the apps themselves, dropping inactive
  // apps and the App Config tool itself (no point configuring the configurator).
  const apps = (perms || [])
    .map((p) => (Array.isArray(p.biz_apps) ? p.biz_apps[0] : p.biz_apps))
    .filter((a) => a && a.app_link !== '/admin/app-config')

  return (
    <AppConfigClient
      appName={appMeta?.app_name || 'App Config'}
      facilityId={fid}
      initialApps={apps}
      initialConfig={config || []}
      initialGroups={groups || []}
    />
  )
}
