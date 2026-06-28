import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import UserFormClient from './UserFormClient'

export const dynamic = 'force-dynamic'

// Single user — edit an existing biz_user, or render a blank form when the
// route is /master-control/users/new. Master Control only. Loads every facility
// for the company dropdown.
export default async function Page({ params }) {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const { id } = await params
  const isNew = id === 'new'

  const supabase = await createClient()

  const facilitiesPromise = supabase
    .from('facilities')
    .select('id, name')
    .order('name', { ascending: true, nullsFirst: false })

  let bizUser = null
  if (isNew) {
    const { data: facilities } = await facilitiesPromise
    return <UserFormClient bizUser={null} isNew facilities={facilities || []} />
  }

  const [{ data: facilities }, { data }] = await Promise.all([
    facilitiesPromise,
    supabase.from('biz_users').select('*').eq('id', id).maybeSingle(),
  ])
  bizUser = data

  return <UserFormClient bizUser={bizUser} isNew={false} facilities={facilities || []} />
}
