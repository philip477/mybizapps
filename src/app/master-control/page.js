import { createClient } from '@/lib/supabase-server'
import MasterControlClient from './MasterControlClient'

export const dynamic = 'force-dynamic'

// Master Control dashboard — the home surface for master_control operators.
// Lists the platform-level apps (app_type = 'Master Control') rather than a
// facility's user apps. Top-level only (app_parent is null) and excludes the
// dashboard's own tile.
export default async function Page() {
  const supabase = await createClient()

  const { data: masterApps } = await supabase
    .from('biz_apps')
    .select('id, app_name, app_icon, app_link, active, app_type, app_parent')
    .eq('app_type', 'Master Control')
    .eq('active', true)
    .is('app_parent', null)
    .neq('app_link', '/master-control')
    .order('app_name', { ascending: true })

  return <MasterControlClient apps={masterApps || []} />
}
