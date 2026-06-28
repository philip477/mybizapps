import { createClient } from '@/lib/supabase-server'
import MasterControlClient from './MasterControlClient'

export const dynamic = 'force-dynamic'

// Master Control dashboard — the home surface for master_control operators.
// Lists the platform-level apps (app_type = 'Master Control') rather than a
// facility's user apps. Top-level only (app_parent is null) and excludes the
// dashboard's own tile.
export default async function Page() {
  const supabase = await createClient()

  // Load the Master Control launcher's own meta (icon + name) for the header
  // alongside its child apps, mirroring the facility app launcher.
  const [{ data: appMeta }, { data: masterApps }] = await Promise.all([
    supabase
      .from('biz_apps')
      .select('app_name, app_icon, app_icon_emoji')
      .eq('app_link', '/master-control')
      .maybeSingle(),
    supabase
      .from('biz_apps')
      .select('id, app_name, app_icon, app_icon_emoji, app_link, active, app_type, app_parent')
      .eq('app_type', 'Master Control')
      .eq('active', true)
      .is('app_parent', null)
      .neq('app_link', '/master-control')
      .order('app_name', { ascending: true }),
  ])

  // The Master Control launcher has no catalog row of its own, so fall back to a
  // control-panel emoji in the header to mirror the facility launcher's app icon.
  return (
    <MasterControlClient
      apps={masterApps || []}
      appIcon={appMeta?.app_icon || appMeta?.app_icon_emoji || '🎛️'}
      appName={appMeta?.app_name || 'Master Control'}
    />
  )
}
