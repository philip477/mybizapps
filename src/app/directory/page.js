import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import DirectoryClient from './DirectoryClient'

export const dynamic = 'force-dynamic'

// Employee Directory — a facility-wide list of colleagues with tap-to-call
// contact info, modeled on the MyLTC Apps directory. The Extensions tab is
// gated by the `directory_show_extensions` App Config toggle (a super_user
// enables it for facilities that run a phone system with extensions).
//
// biz_users RLS scopes every read to the caller's facility, so the employee
// query needs no explicit facility filter.
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const fid = user.facility_id

  // App meta first (its id keys the per-facility config row below).
  const { data: appMeta } = await supabase
    .from('biz_apps')
    .select('id, app_name, app_icon, app_icon_emoji')
    .eq('app_link', '/directory')
    .maybeSingle()

  const [{ data: cfg }, { data: employees }] = await Promise.all([
    appMeta?.id && fid
      ? supabase
          .from('biz_app_config')
          .select('config_value')
          .eq('facility_id', fid)
          .eq('app_id', appMeta.id)
          .eq('config_key', 'directory_show_extensions')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('biz_users')
      .select('id, first_name, last_name, display_name, job_title, department, phone, cell_phone, profile_photo_url')
      .eq('active', true)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true }),
  ])

  return (
    <DirectoryClient
      appIcon={appMeta?.app_icon || appMeta?.app_icon_emoji || '📇'}
      appName={appMeta?.app_name || 'Employee Directory'}
      employees={employees || []}
      showExtensions={cfg?.config_value === 'true'}
    />
  )
}
