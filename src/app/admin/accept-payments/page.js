import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'
import AcceptPaymentsClient from './AcceptPaymentsClient'

export const dynamic = 'force-dynamic'

// Accept Payments — the facility-admin surface that walks a super_user through
// Stripe Connect (Express) onboarding so their company can take card payments.
// Gated to super_user; RLS guards the underlying biz_facility_payments writes.
//
// Status is resolved server-side: read the persisted flags, then (when a Connect
// account exists) refresh them from Stripe. The refresh is wrapped so a missing
// STRIPE_SECRET_KEY degrades to "not set up" instead of crashing the page.
export default async function Page() {
  const user = await getUser()
  if (!user || user.role !== 'super_user') redirect('/')

  const supabase = await createClient()
  const fid = user.facility_id

  const { data: pay } = await supabase
    .from('biz_facility_payments')
    .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted, onboarded_at')
    .eq('facility_id', fid)
    .maybeSingle()

  let status = {
    connected: !!pay?.stripe_account_id,
    charges_enabled: !!pay?.charges_enabled,
    payouts_enabled: !!pay?.payouts_enabled,
    details_submitted: !!pay?.details_submitted,
  }

  if (pay?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(pay.stripe_account_id)
      status = {
        connected: true,
        charges_enabled: !!account.charges_enabled,
        payouts_enabled: !!account.payouts_enabled,
        details_submitted: !!account.details_submitted,
      }
      await supabase
        .from('biz_facility_payments')
        .update({
          charges_enabled: status.charges_enabled,
          payouts_enabled: status.payouts_enabled,
          details_submitted: status.details_submitted,
          onboarded_at: status.charges_enabled ? (pay.onboarded_at || new Date().toISOString()) : pay.onboarded_at,
          updated_at: new Date().toISOString(),
        })
        .eq('facility_id', fid)
    } catch {
      // Stripe not configured or unreachable — keep the persisted flags.
    }
  }

  return <AcceptPaymentsClient initialStatus={status} />
}
