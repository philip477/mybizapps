import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import GroupTasksClient from './GroupTasksClient'

// My Groups — server component.
//
// Loads the facility's active groups and active group tasks (RLS already
// scopes both to the caller's facility), plus the caller's own group
// memberships. The client component filters down to the groups the user
// actually belongs to and renders the per-group task checklist.
//
// Adapted from the MyLTC Apps /my-groups page, generalized for business use:
//   ltc_ → biz_, ltc_users → biz_users, healthcare language → business
//   language. The biz schema keys membership / created_by / completed_by off
//   biz_users.id (uuid) rather than email, so we resolve the caller up front.
export default async function Page() {
  const supabase = await createClient()
  const user = await getUser()

  const [
    { data: appMeta },
    { data: groups },
    { data: tasks },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from('biz_apps')
      .select('app_name, app_icon, app_icon_emoji')
      .eq('app_link', '/my-groups')
      .maybeSingle(),
    supabase
      .from('biz_groups')
      .select('*')
      .eq('active', true)
      .order('name'),
    supabase
      .from('biz_group_tasks')
      .select('*')
      .eq('active', true)
      .order('due_date'),
    user
      ? supabase
          .from('biz_group_members')
          .select('group_id, is_admin')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <GroupTasksClient
        appName={appMeta?.app_name || 'My Groups'}
        myUserId={user?.id || null}
        initialGroups={groups || []}
        initialTasks={tasks || []}
        initialMemberships={memberships || []}
      />
    </div>
  )
}
