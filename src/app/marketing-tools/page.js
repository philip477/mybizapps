import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import MarketingToolsClient from './MarketingToolsClient'

export const dynamic = 'force-dynamic'

// Marketing Dashboard — a unified hub: a contact-base cockpit (KPIs, "do this
// next" worklists, growth trend), the three client-side design generators, a
// CRM/Contacts view, and a Campaigns tab (segment CSV export). Access is
// group-gated on the home launcher (marketing_tools_access_group); reaching the
// page only requires an authenticated session. The client reads biz_customers
// directly under facility-scoped RLS.
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  return <MarketingToolsClient />
}
