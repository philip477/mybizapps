import { createClient } from '@/lib/supabase-server'
import ServiceCallFormClient from './ServiceCallFormClient'

// Server component — loads the service call (edit) plus the pickers' data:
// customers, service types, and technicians (facility users). RLS scopes all.
export default async function Page({ params }) {
  const { id } = await params
  const isNew = id === 'new'

  const supabase = await createClient()

  const customersPromise = supabase
    .from('biz_customers')
    .select('id, company_name, first_name, last_name')
    .order('company_name', { ascending: true, nullsFirst: false })
  const typesPromise = supabase
    .from('biz_service_types')
    .select('id, name, color')
    .order('name', { ascending: true })
  const techsPromise = supabase
    .from('biz_users')
    .select('id, first_name, last_name, email')
    .order('first_name', { ascending: true })

  let call = null
  if (!isNew) {
    const { data } = await supabase.from('biz_service_calls').select('*').eq('id', id).maybeSingle()
    call = data
  }

  const [{ data: customers }, { data: serviceTypes }, { data: techs }] = await Promise.all([
    customersPromise,
    typesPromise,
    techsPromise,
  ])

  return (
    <ServiceCallFormClient
      isNew={isNew}
      call={call}
      customers={customers || []}
      serviceTypes={serviceTypes || []}
      techs={techs || []}
    />
  )
}
