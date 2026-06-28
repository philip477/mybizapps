import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import AppFormClient from './AppFormClient'

export const dynamic = 'force-dynamic'

// Single app — edit an existing biz_app, or render a blank form when the route
// is /master-control/apps/new. Master Control only.
export default async function Page({ params }) {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const { id } = await params
  const isNew = id === 'new'

  let app = null
  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('biz_apps')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    app = data
  }

  return <AppFormClient app={app} isNew={isNew} />
}
