import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import AppsClient from './AppsClient'

export const dynamic = 'force-dynamic'

// Edit Apps — the platform-wide app catalog, Master Control only. proxy.js
// already confines /master-control to master_control accounts; the getUser
// check here is defense-in-depth. RLS lets master_control read every app.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_apps')
    .select('id, app_name, app_type, app_icon, app_icon_emoji, active, sort_order')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('app_name', { ascending: true, nullsFirst: false })

  return <AppsClient initialApps={data || []} />
}
