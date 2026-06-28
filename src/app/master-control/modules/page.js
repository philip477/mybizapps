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

  // Pull the Modules app's own meta (icon + name) for the header alongside the
  // module catalog.
  const [{ data: appMeta }, { data }] = await Promise.all([
    supabase
      .from('biz_apps')
      .select('app_name, app_icon, app_icon_emoji')
      .eq('app_link', '/master-control/modules')
      .maybeSingle(),
    supabase
      .from('biz_modules')
      .select('id, name, slug, description, icon, price_yearly, is_base, active, sort_order')
      .order('is_base', { ascending: false })
      .order('sort_order', { ascending: true }),
  ])

  return (
    <ModulesClient
      initialModules={data || []}
      appIcon={appMeta?.app_icon || appMeta?.app_icon_emoji || '📦'}
      appName={appMeta?.app_name || 'Modules'}
    />
  )
}
