import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import CustomerFormClient from './CustomerFormClient'

// Server component — loads a single customer for edit, or renders a blank form
// when the route is /customers/new.
export default async function Page({ params }) {
  const { id } = await params
  const isNew = id === 'new'

  let customer = null
  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('biz_customers')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    customer = data
  }
  // A missing/cross-tenant id must 404, not render a blank "edit" form.
  if (!isNew && !customer) notFound()

  return <CustomerFormClient customer={customer} isNew={isNew} />
}
