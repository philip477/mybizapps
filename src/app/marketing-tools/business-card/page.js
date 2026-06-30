import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import BusinessCardClient from './BusinessCardClient'

export const dynamic = 'force-dynamic'

// Business Card Generator — prefills from the caller's biz_users profile and
// their facility. `facilities` uses `name`/`logo_url` (not company_name/logo).
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const [{ data: profile }, { data: facility }] = await Promise.all([
    supabase
      .from('biz_users')
      .select('first_name, last_name, display_name, job_title, phone, cell_phone, email')
      .eq('id', user.id)
      .maybeSingle(),
    user.facility_id
      ? supabase
          .from('facilities')
          .select('name, logo_url, phone, address, city, state, zip')
          .eq('id', user.facility_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const fullName =
    profile?.display_name ||
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    user.full_name ||
    ''

  const cityLine = facility
    ? [facility.address, [facility.city, facility.state].filter(Boolean).join(', '), facility.zip]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <BusinessCardClient
      initial={{
        name: fullName,
        title: profile?.job_title || '',
        company: facility?.name || '',
        phone: profile?.phone || profile?.cell_phone || facility?.phone || '',
        email: profile?.email || user.email || '',
        website: '',
        address: cityLine,
        logoUrl: facility?.logo_url || '',
      }}
    />
  )
}
