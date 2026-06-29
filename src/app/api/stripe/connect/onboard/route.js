// Start (or resume) Stripe Connect Express onboarding for the caller's facility.
// Pass-through model: the facility is an Express connected account and merchant
// of record, paying Stripe's own rates. Creates the account on first use, then
// returns a hosted Account Link URL for the facility to complete KYC/bank setup.
//
// POST → { ok, url }   (super_user only; RLS also enforces facility-admin)
import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'super_user') return Response.json({ error: 'Admin access required' }, { status: 403 })
  if (!user.facility_id) return Response.json({ error: 'No facility for user' }, { status: 403 })

  const supabase = await createClient()
  const fid = user.facility_id

  const [{ data: pay }, { data: facility }] = await Promise.all([
    supabase.from('biz_facility_payments').select('stripe_account_id').eq('facility_id', fid).maybeSingle(),
    supabase.from('facilities').select('name').eq('id', fid).maybeSingle(),
  ])

  try {
    let accountId = pay?.stripe_account_id
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email || undefined,
        business_type: 'company',
        company: facility?.name ? { name: facility.name } : undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { facility_id: fid },
      })
      accountId = account.id
      const { error } = await supabase
        .from('biz_facility_payments')
        .upsert(
          { facility_id: fid, stripe_account_id: accountId, updated_at: new Date().toISOString() },
          { onConflict: 'facility_id' },
        )
      if (error) throw error
    }

    const origin = new URL(request.url).origin
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/admin/accept-payments?refresh=1`,
      return_url: `${origin}/admin/accept-payments?done=1`,
      type: 'account_onboarding',
    })
    return Response.json({ ok: true, url: link.url })
  } catch (err) {
    return Response.json({ error: err.message || 'Onboarding failed' }, { status: 502 })
  }
}
