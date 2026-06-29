import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import ModulesClient from './ModulesClient'

export const dynamic = 'force-dynamic'

// Manage Modules — the facility-admin surface for enabling/disabling the
// company's modules (a super_user tool under Business Control). The global
// module catalog itself is built in Master Control → Modules; here a facility
// admin only flips which of those modules their company runs.
//
// Gated to super_user at the page layer; RLS is the real boundary
// (biz_facility_modules writes require is_facility_admin() in the row's
// facility, or is_master_control()).
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()
  const fid = user.facility_id

  const [{ data: appMeta }, { data: modules }, { data: facMods }, { data: apps }] =
    await Promise.all([
      supabase
        .from('biz_apps')
        .select('app_name, app_icon, app_icon_emoji')
        .eq('app_link', '/admin/modules')
        .maybeSingle(),
      supabase
        .from('biz_modules')
        .select('id, name, description, icon, price_yearly, is_base, sort_order')
        .eq('active', true)
        .order('is_base', { ascending: false })
        .order('sort_order', { ascending: true }),
      fid
        ? supabase
            .from('biz_facility_modules')
            .select('module_id, enabled')
            .eq('facility_id', fid)
        : Promise.resolve({ data: [] }),
      // Apps assigned to a module, for the per-module app counts / drill-down.
      supabase
        .from('biz_apps')
        .select('id, app_name, app_icon, app_icon_emoji, app_link, app_type, module_id')
        .not('module_id', 'is', null)
        .eq('active', true)
        .order('app_name', { ascending: true }),
    ])

  return (
    <ModulesClient
      appIcon={appMeta?.app_icon || appMeta?.app_icon_emoji || '📦'}
      appName={appMeta?.app_name || 'Manage Modules'}
      facilityId={fid}
      modules={modules || []}
      facilityModules={facMods || []}
      apps={apps || []}
    />
  )
}
