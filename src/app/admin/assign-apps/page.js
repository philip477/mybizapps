import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import AssignAppsClient from './AssignAppsClient'

export const dynamic = 'force-dynamic'

// Assign Company Apps — super_user surface for choosing which apps the
// facility has access to, and in what order they appear on the home launcher.
//
// Membership lives in biz_app_permission_mains (facility_id, app_id, app_order,
// active). Toggling an app on adds/re-activates its row; toggling off sets
// active=false (the row is kept so its order survives a re-enable). Only
// `User App` types are assignable — admin/master tools are wired elsewhere.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()
  const fid = user.facility_id

  const [{ data: appMeta }, { data: allApps }, { data: perms }] = await Promise.all([
    supabase
      .from('biz_apps')
      .select('app_name, app_icon, app_icon_emoji')
      .eq('app_link', '/admin/assign-apps')
      .maybeSingle(),
    supabase
      .from('biz_apps')
      .select('id, app_name, app_icon, app_icon_emoji, app_link, sort_order')
      .eq('app_type', 'User App')
      .eq('active', true)
      .order('app_name'),
    fid
      ? supabase
          .from('biz_app_permission_mains')
          .select('id, app_id, app_order, active')
          .eq('facility_id', fid)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <AssignAppsClient
      appName={appMeta?.app_name || 'Assign Company Apps'}
      facilityId={fid}
      initialApps={allApps || []}
      initialPerms={perms || []}
    />
  )
}
