import { createClient } from '@/lib/supabase-server'
import IncomeFormClient from './IncomeFormClient'

// Server component — loads a single income entry for edit, or a blank form for new.
export default async function Page({ params }) {
  const { id } = await params
  const isNew = id === 'new'

  let income = null
  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase.from('biz_income').select('*').eq('id', id).maybeSingle()
    income = data
  }

  return <IncomeFormClient income={income} isNew={isNew} />
}
