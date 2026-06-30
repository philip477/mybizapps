-- provision_signup — stands up a brand-new facility for a self-serve signup.
--
-- WHY: The /signup flow creates a fresh Supabase auth user who has NO biz_users
-- row yet. Because biz_users RLS is scoped to the caller's facility
-- (get_user_facility_id() needs an existing linked row), and facilities /
-- biz_app_permission_mains writes require is_master_control()/is_facility_admin(),
-- the new session cannot create its own tenant through the normal RLS path.
-- This SECURITY DEFINER function runs as the owner (bypassing RLS) and performs
-- the whole provisioning atomically: create the facility, create the caller's
-- biz_users row as the facility-admin (super_user), and enable every active
-- "User App" for the new facility.
--
-- SAFETY: It keys everything on auth.uid() (the verified caller) — never a
-- client-supplied id — so a caller can only ever provision THEMSELVES. It is
-- idempotent: if the caller (or their email) is already provisioned it links and
-- returns the existing facility instead of creating a duplicate. It mirrors the
-- link_auth_user pattern already used on first login.
--
-- Run this once in the Supabase SQL editor (it is not auto-applied by deploys).

create or replace function provision_signup(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_company_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_facility_id uuid;
  v_base text;
  v_slug text;
  v_n int := 0;
  v_display text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Already provisioned for this auth identity → return the existing facility.
  select facility_id into v_facility_id
  from biz_users
  where auth_id = v_uid
  limit 1;
  if v_facility_id is not null then
    return v_facility_id;
  end if;

  -- A pre-provisioned row may exist by email with a NULL auth_id (admin-created
  -- ahead of signup). Claim it rather than creating a second tenant.
  select facility_id into v_facility_id
  from biz_users
  where lower(email) = lower(p_email)
  limit 1;
  if v_facility_id is not null then
    update biz_users
    set auth_id = v_uid
    where lower(email) = lower(p_email)
      and auth_id is null;
    return v_facility_id;
  end if;

  -- Derive a URL-safe, unique slug from the company name (mirrors slugify() in
  -- the master-control company form).
  v_base := regexp_replace(lower(trim(coalesce(p_company_name, ''))), '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  if v_base = '' then
    v_base := 'company';
  end if;
  v_slug := v_base;
  while exists (select 1 from facilities where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  -- Create the tenant.
  insert into facilities (name, slug, active, login_method)
  values (trim(p_company_name), v_slug, true, 'email')
  returning id into v_facility_id;

  v_display := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));

  -- Create the caller's profile as the facility admin (super_user), pre-linked
  -- to this auth identity so the home page resolves their facility immediately.
  insert into biz_users (
    auth_id, facility_id, email, first_name, last_name, display_name, user_role, active
  )
  values (
    v_uid,
    v_facility_id,
    lower(trim(p_email)),
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    nullif(v_display, ''),
    'super_user',
    true
  );

  -- Enable every active "User App" for the new facility, ordered by name.
  insert into biz_app_permission_mains (facility_id, app_id, app_order, active)
  select v_facility_id, a.id, (row_number() over (order by a.app_name)) - 1, true
  from biz_apps a
  where a.active = true
    and a.app_type = 'User App';

  return v_facility_id;
end;
$$;

-- Callable by any signed-in user; the body restricts each caller to provisioning
-- their own (auth.uid()) tenant exactly once.
grant execute on function provision_signup(text, text, text, text) to authenticated;
