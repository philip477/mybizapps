import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ModulesClient from './ModulesClient'

// Master Control → Modules. Lists the global module catalog (biz_modules).
// Access is confined to master_control by proxy.js (/master-control/*). The
// catalog is global (not facility-scoped); RLS lets any authenticated user read
// and only is_master_control() write.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_modules')
    .select('id, name, slug, description, icon, price_yearly, is_base, active, sort_order')
    .order('is_base', { ascending: false })
    .order('sort_order', { ascending: true })

  return <ModulesClient initialModules={data || []} />
}
