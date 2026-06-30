import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import LogoGeneratorClient from './LogoGeneratorClient'

export const dynamic = 'force-dynamic'

// Logo Generator — prefills the company name from the caller's facility. The
// `facilities` table uses `name`/`logo_url` (not company_name/company_logo).
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: facility } = user.facility_id
    ? await supabase
        .from('facilities')
        .select('name, logo_url')
        .eq('id', user.facility_id)
        .maybeSingle()
    : { data: null }

  return <LogoGeneratorClient companyName={facility?.name || ''} />
}
