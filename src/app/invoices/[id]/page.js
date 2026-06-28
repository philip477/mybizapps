import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import InvoiceFormClient from './InvoiceFormClient'

// Server component — loads the invoice/quote with its line items (edit) or sets
// up a blank doc (new), plus the facility's customers for the picker and the
// facility record (company name/logo/address) for the printable preview.
export default async function Page({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const isNew = id === 'new'
  const docType = sp?.type === 'quote' ? 'quote' : 'invoice'

  const supabase = await createClient()
  const user = await getUser()

  // Full customer records — the preview's "Bill To" needs address + email, and
  // they're cheap to carry for the picker too.
  const customersPromise = supabase
    .from('biz_customers')
    .select('id, company_name, first_name, last_name, email, phone, address, city, state, zip')
    .order('company_name', { ascending: true, nullsFirst: false })

  // Facility (the "from" company on the printed document).
  const facilityPromise = user?.facility_id
    ? supabase
        .from('facilities')
        .select('name, logo_url, address, city, state, zip, phone')
        .eq('id', user.facility_id)
        .maybeSingle()
    : Promise.resolve({ data: null })

  // Active service catalog — powers the "Add from catalog" line-item picker.
  const servicesPromise = supabase
    .from('biz_service_catalog')
    .select('id, name, description, pricing_type, flat_rate, hourly_rate, estimated_hours, category')
    .eq('active', true)
    .order('category', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

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
    // A missing/cross-tenant id must 404, not render a blank "edit" form.
    if (!invoice) notFound()
    items = lineItems || []
  }

  const [{ data: customers }, { data: facility }, { data: services }] = await Promise.all([
    customersPromise,
    facilityPromise,
    servicesPromise,
  ])

  return (
    <InvoiceFormClient
      isNew={isNew}
      docType={invoice?.doc_type || docType}
      invoice={invoice}
      items={items}
      customers={customers || []}
      facility={facility}
      services={services || []}
    />
  )
}
