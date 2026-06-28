import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import CompaniesClient from './CompaniesClient'

export const dynamic = 'force-dynamic'

// Companies (facilities) admin — Master Control only. proxy.js already confines
// the /master-control area to master_control accounts; the getUser check here is
// defense-in-depth. RLS lets master_control read every facility.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const supabase = await createClient()

  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, phone, active')
    .order('name', { ascending: true, nullsFirst: false })

  return <CompaniesClient initialCompanies={data || []} />
}
