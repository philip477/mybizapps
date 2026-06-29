import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import BusinessAdminClient from '@/app/business-admin-apps/BusinessAdminClient'

export const dynamic = 'force-dynamic'

// Company Config — a sub-hub under Business Control for company-wide settings
// (as opposed to App Config's per-app settings). Currently houses Accept
// Payments; add further company-level tools here as they arrive.
const COMPANY_CONFIG_APPS = [
  { id: 'accept-payments', app_name: 'Accept Payments', app_link: '/admin/accept-payments', app_icon: null, app_icon_emoji: '💳' },
]

export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  return (
    <BusinessAdminClient
      apps={COMPANY_CONFIG_APPS}
      title="Company Config"
      subtitle="Company-wide settings for your business."
      backHref="/business-admin-apps"
    />
  )
}
