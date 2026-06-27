import { createClient } from '@/lib/supabase-server'
import InvoicesClient from './InvoicesClient'

// Server component — loads invoices/quotes with the related customer. RLS scopes
// rows to the caller's facility.
export default async function Page() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('biz_invoices')
    .select(
      'id, doc_type, invoice_number, status, total, due_date, customer_id, created_at, biz_customers(company_name, first_name, last_name)'
    )
    .order('created_at', { ascending: false })

  return <InvoicesClient initialDocs={data || []} />
}
