import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import CompanyFormClient from './CompanyFormClient'

export const dynamic = 'force-dynamic'

// Single company — edit an existing facility, or render a blank form when the
// route is /master-control/facilities/new. Master Control only.
export default async function Page({ params }) {
  const user = await getUser()
  if (!user || user.role !== 'master_control') redirect('/')

  const { id } = await params
  const isNew = id === 'new'

  let company = null
  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    company = data
  }

  return <CompanyFormClient company={company} isNew={isNew} />
}
