import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import MyGroupsClient from './MyGroupsClient'

// My Groups — server component.
//
// Shows the groups the caller belongs to and lets them browse the members of
// each. Super users (and master_control) see every group in the facility and
// can create / edit groups and manage membership inline.
//
// This is NOT a task surface. Tasks live on /my-tasks. /my-groups is purely
// about group membership — adapted from the MyLTC Apps group admin screen,
// generalized for business use (ltc_ → biz_, healthcare → business language).
//
// We load the facility's active groups, every group membership (RLS scopes
// both to the caller's facility), and the facility's active users so member
// rows can be rendered with real names. The client filters down to the groups
// the caller can see and resolves member_id → user.
export default async function Page() {
  const supabase = await createClient()
  const user = await getUser()

  const [
    { data: appMeta },
    { data: groups },
    { data: members },
    { data: users },
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
      .from('biz_group_members')
      .select('id, group_id, user_id, member_role, is_admin'),
    user
      ? supabase
          .from('biz_users')
          .select('id, first_name, last_name, email')
          .eq('facility_id', user.facility_id)
          .eq('active', true)
          .order('last_name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <MyGroupsClient
        appName={appMeta?.app_name || 'My Groups'}
        myUserId={user?.id || null}
        myRole={user?.role || null}
        myFacilityId={user?.facility_id || null}
        initialGroups={groups || []}
        initialMembers={members || []}
        initialUsers={users || []}
      />
    </div>
  )
}
