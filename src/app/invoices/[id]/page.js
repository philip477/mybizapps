import { createClient } from '@/lib/supabase-server'
import InvoiceFormClient from './InvoiceFormClient'

// Server component — loads the invoice/quote with its line items (edit) or sets
// up a blank doc (new), plus the facility's customers for the picker.
export default async function Page({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const isNew = id === 'new'
  const docType = sp?.type === 'quote' ? 'quote' : 'invoice'

  const supabase = await createClient()

  const customersPromise = supabase
    .from('biz_customers')
    .select('id, company_name, first_name, last_name')
    .order('company_name', { ascending: true, nullsFirst: false })

  let invoice = null
  let items = []
  if (!isNew) {
    const [{ data: inv }, { data: lineItems }] = await Promise.all([
      supabase.from('biz_invoices').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('biz_invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order', { ascending: true }),
    ])
    invoice = inv
    items = lineItems || []
  }

  const { data: customers } = await customersPromise

  return (
    <InvoiceFormClient
      isNew={isNew}
      docType={invoice?.doc_type || docType}
      invoice={invoice}
      items={items}
      customers={customers || []}
    />
  )
}
