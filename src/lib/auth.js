import { createClient } from './supabase-server'

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
    // Escape ILIKE wildcards ('_' and '%' are legal in email local-parts) so the
    // email matches literally, not as a pattern, against the facility-scoped rows.
    .ilike('email', (user.email || '').replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()

  if (!bizUser) {
    return null
  }

  return {
    id: bizUser.id,
    email: bizUser.email,
    full_name: `${bizUser.first_name || ''} ${bizUser.last_name || ''}`.trim(),
    first_name: bizUser.first_name,
    last_name: bizUser.last_name,
    role: bizUser.user_role,
    facility_id: bizUser.facility_id,
  }
}
