import { createClient } from '@/lib/supabase-server'
import ServiceScheduleClient from './ServiceScheduleClient'

// Server component — loads service calls with their customer and service type.
// RLS scopes rows to the caller's facility.
export default async function Page() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_service_calls')
    .select(
      'id, title, customer_id, service_type_id, assigned_tech, scheduled_date, scheduled_time, duration_minutes, status, started_at, completed_at, biz_customers(company_name, first_name, last_name), biz_service_types(name, color)'
    )
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })

  return <ServiceScheduleClient initialCalls={data || []} />
}
