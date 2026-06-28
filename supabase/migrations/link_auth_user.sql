-- link_auth_user — binds a pre-provisioned biz_users row to its Supabase auth
-- identity on first login.
--
-- WHY: Manage Superusers can create a biz_users row (email, role, facility_id)
-- before the person has ever signed in, so auth_id is NULL. When they later
-- authenticate (Google OAuth or password), their row is keyed on email but its
-- auth_id is still NULL — and because biz_users RLS is scoped to the caller's
-- auth identity, the brand-new session can't see (or UPDATE) that row to link
-- itself. This SECURITY DEFINER function runs as the owner, bypassing RLS, so
-- any authenticated caller can claim the row that matches their own email.
--
-- It is safe and idempotent: it only ever fills a NULL auth_id, matched by
-- email, so it can't steal an already-linked row and re-running it is a no-op.
--
-- Run this once in the Supabase SQL editor (it is not auto-applied by deploys).

create or replace function link_auth_user(p_auth_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update biz_users
  set auth_id = p_auth_id
  where lower(email) = lower(p_email)
    and auth_id is null;
end;
$$;

-- Callable by any signed-in user (each can only fill the row matching its own
-- email, passed from the verified session below).
grant execute on function link_auth_user(uuid, text) to authenticated;
