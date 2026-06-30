import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import FlyerGeneratorClient from './FlyerGeneratorClient'

export const dynamic = 'force-dynamic'

// Flyer Generator — prefills company name + contact from the facility.
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: facility } = user.facility_id
    ? await supabase
        .from('facilities')
        .select('name, phone, address, city, state, zip')
        .eq('id', user.facility_id)
        .maybeSingle()
    : { data: null }

  const cityLine = facility
    ? [facility.address, [facility.city, facility.state].filter(Boolean).join(', '), facility.zip]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <FlyerGeneratorClient
      initial={{
        company: facility?.name || '',
        contact: [facility?.phone, cityLine].filter(Boolean).join('  ·  '),
      }}
    />
  )
}
