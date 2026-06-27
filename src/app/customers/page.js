import { createClient } from '@/lib/supabase-server'
import CustomersClient from './CustomersClient'

// Server component — loads the facility's customers. RLS scopes rows to the
// caller's facility (get_user_facility_id()), so no explicit filter is needed.
export default async function Page() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_customers')
    .select('id, company_name, first_name, last_name, email, phone')
    .order('company_name', { ascending: true, nullsFirst: false })
    .order('last_name', { ascending: true })

  return <CustomersClient initialCustomers={data || []} />
}
