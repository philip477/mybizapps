import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import ServicesClient from './ServicesClient'

export const dynamic = 'force-dynamic'

// Manage Services — super_user surface for the facility's service catalog.
// RLS scopes biz_service_catalog rows to the caller's facility, so no explicit
// filter is needed; we just order by category then sort_order for grouping.
//
// Admin access is super_user-only here, matching the other Business Control
// tools. master_control is confined to the Master Control area by proxy.js.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_service_catalog')
    .select('id, name, description, pricing_type, flat_rate, hourly_rate, estimated_hours, category, active, sort_order')
    .order('category', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return <ServicesClient initialServices={data || []} />
}
