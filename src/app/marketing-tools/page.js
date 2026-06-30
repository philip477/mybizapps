import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import MarketingToolsClient from './MarketingToolsClient'

export const dynamic = 'force-dynamic'

// Marketing Tools — hub listing the three client-side generators. Access is
// group-gated on the home launcher (marketing_tools_access_group); reaching the
// page only requires an authenticated session.
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')

  return <MarketingToolsClient />
}
