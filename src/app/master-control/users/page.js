import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

// Manage Superusers — Master Control only. proxy.js already confines the
// /master-control area to master_control accounts; the getUser check here is
// defense-in-depth. Lists every biz_user with their company, but the page is
// built around surfacing super_user and master_control roles across facilities.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_users')
    .select(
      'id, email, first_name, last_name, display_name, user_role, active, facility_id, facilities ( id, name )'
    )
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true, nullsFirst: false })

  return <UsersClient initialUsers={data || []} />
}
