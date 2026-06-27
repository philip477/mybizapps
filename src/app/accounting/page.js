import { createClient } from '@/lib/supabase-server'
import AccountingClient from './AccountingClient'

// Server component — loads expenses (with category) and income for the facility.
// RLS scopes rows to the caller's facility. Month summaries are computed client-side.
export default async function Page() {
  const supabase = await createClient()

  const [{ data: expenses }, { data: income }] = await Promise.all([
    supabase
      .from('biz_expenses')
      .select('id, description, amount, expense_date, vendor, category_id, biz_expense_categories(name)')
      .order('expense_date', { ascending: false }),
    supabase
      .from('biz_income')
      .select('id, description, amount, income_date, source')
      .order('income_date', { ascending: false }),
  ])

  return <AccountingClient expenses={expenses || []} income={income || []} />
}
