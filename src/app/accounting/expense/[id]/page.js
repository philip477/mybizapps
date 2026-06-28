import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import ExpenseFormClient from './ExpenseFormClient'

// Server component — loads a single expense (edit) and the facility's expense
// categories for the picker.
export default async function Page({ params }) {
  const { id } = await params
  const isNew = id === 'new'

  const supabase = await createClient()

  const categoriesPromise = supabase
    .from('biz_expense_categories')
    .select('id, name')
    .order('name', { ascending: true })

  let expense = null
  if (!isNew) {
    const { data } = await supabase.from('biz_expenses').select('*').eq('id', id).maybeSingle()
    expense = data
  }
  if (!isNew && !expense) notFound()

  const { data: categories } = await categoriesPromise

  return <ExpenseFormClient expense={expense} isNew={isNew} categories={categories || []} />
}
