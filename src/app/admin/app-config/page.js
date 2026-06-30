import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import AppConfigClient from './AppConfigClient'

export const dynamic = 'force-dynamic'

// App Config — super_user surface for configuring per-facility app settings.
//
// This surface is template-driven (see ./templates.js): a super_user can only
// set values for predefined keys, never invent new ones. Values persist in
// biz_app_config, scoped by (facility_id, app_id, config_key). The classic use
// is an `*_admin_group` key that names which biz_group administers an app —
// there is no role bypass, so admin access is always group-driven.
//
// This loader passes every assigned app plus all config rows and the facility's
// groups down to the client, which keeps only apps that have a template and
// renders each field by its declared type. There are no templates defined yet,
// so the client's clean empty state is the current norm.
//
// Only super_users reach this page. master_control is confined to the Master
// Control area by proxy.js, and regular users are bounced home below.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()
  const fid = user.facility_id

  // The fields the client needs to render each app tile.
  const APP_FIELDS = 'id, app_name, app_icon, app_icon_emoji, app_link, app_type, active'

  const [{ data: appMeta }, { data: perms }, { data: config }, { data: groups }, { data: facilityConfig }] =
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
            .select(`app_order, biz_apps(${APP_FIELDS})`)
            .eq('facility_id', fid)
            .order('app_order')
        : Promise.resolve({ data: [] }),
      // ALL config rows for the facility, loaded independently of the app list
      // so every enabled app shows up here whether or not it has config yet.
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
      // Facility-wide settings (e.g. AI Assist), edited in the General Settings
      // section. Global to the facility, not tied to any app.
      fid
        ? supabase
            .from('biz_facility_config')
            .select('id, config_key, config_value')
            .eq('facility_id', fid)
        : Promise.resolve({ data: [] }),
    ])

  // Resolve the facility's enabled apps exactly the way the home launcher does:
  // flatten the permission join and keep globally-active apps. An app appears
  // here even with zero config keys — config is merged in client-side.
  let apps = (perms || [])
    .map((p) => (Array.isArray(p.biz_apps) ? p.biz_apps[0] : p.biz_apps))
    .filter((a) => a && a.active)

  // Fresh-facility fallback: with no permission rows yet, the home launcher
  // shows every active app, so App Config must too — otherwise apps the user
  // can clearly launch would have nowhere to be configured.
  if (apps.length === 0 && fid) {
    const { data: allApps } = await supabase
      .from('biz_apps')
      .select(APP_FIELDS)
      .eq('active', true)
      .order('app_name')
    apps = allApps || []
  }

  // Drop the App Config tool itself — no point configuring the configurator.
  apps = apps.filter((a) => a.app_link !== '/admin/app-config')

  return (
    <AppConfigClient
      appName={appMeta?.app_name || 'Business Config'}
      facilityId={fid}
      initialApps={apps}
      initialConfig={config || []}
      initialGroups={groups || []}
      initialFacilityConfig={facilityConfig || []}
    />
  )
}
