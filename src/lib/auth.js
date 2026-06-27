import { createClient } from './supabase-server'

// getSession — returns the raw Supabase session (no DB join).
export async function getSession() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

// getUser — validates the token server-side, then joins biz_users to return
// the app-level profile (role, facility, name). Returns null when the visitor
// isn't authenticated or isn't provisioned in biz_users.
export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('*')
    .ilike('useremail', user.email)
    .maybeSingle()

  if (!bizUser) {
    return null
  }

  return {
    id: bizUser.id,
    email: bizUser.useremail,
    full_name: bizUser.full_name,
    first_name: bizUser.first_name,
    role: bizUser.user_role,
    facility_id: bizUser.facility_id,
  }
}
