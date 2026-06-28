import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import ServiceFormClient from './ServiceFormClient'

export const dynamic = 'force-dynamic'

// Server component — loads a single service for edit, or renders a blank form
// when the route is /admin/services/new. Super_user gated, matching the list.
export default async function Page({ params }) {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const { id } = await params
  const isNew = id === 'new'

  let service = null
  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('biz_service_catalog')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    service = data
  }

  return <ServiceFormClient service={service} isNew={isNew} />
}
