import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ModuleFormClient from './ModuleFormClient'

// Server component — loads a single module for edit, or renders a blank form
// when the route is /master-control/modules/new.
export default async function Page({ params }) {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const { id } = await params
  const isNew = id === 'new'

  let moduleRow = null
  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('biz_modules')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    moduleRow = data
  }
  if (!isNew && !moduleRow) notFound()

  return <ModuleFormClient moduleRow={moduleRow} isNew={isNew} />
}
