// POST /api/signup/provision
// Body: { first_name, last_name, company_name }  (email + auth id come from the
//        verified session, never the client, to prevent provisioning someone
//        else's tenant)
//
// Stands up a brand-new facility for a self-serve signup: creates the facility
// (auto-slug, active, login_method='email'), creates the caller's biz_users row
// as the facility-admin (super_user), and enables every active "User App".
//
// All three writes happen inside the SECURITY DEFINER `provision_signup` DB
// function (see supabase/migrations/provision_signup.sql): a brand-new auth user
// has no biz_users row yet, so RLS would otherwise block them from creating a
// facility or their own profile. The function keys off auth.uid(), so it runs
// with the caller's verified identity and is idempotent.
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const supabase = await createClient()

  // The session must already be set (signUp/signIn ran on the client). We take
  // the auth id + email from the validated token, not the request body.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { error: 'Not authenticated. Confirm your email, then sign in.' },
      { status: 401 }
    )
  }

  const company_name = (body?.company_name || '').trim()
  if (!company_name) {
    return Response.json({ error: 'Company name is required.' }, { status: 400 })
  }

  const { data: facilityId, error } = await supabase.rpc('provision_signup', {
    p_email: user.email,
    p_first_name: (body?.first_name || '').trim(),
    p_last_name: (body?.last_name || '').trim(),
    p_company_name: company_name,
  })

  if (error) {
    return Response.json(
      { error: error.message || 'Could not finish setting up your account.' },
      { status: 500 }
    )
  }

  return Response.json({ facility_id: facilityId })
}
