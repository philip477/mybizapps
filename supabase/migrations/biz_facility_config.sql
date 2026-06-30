-- biz_facility_config — facility-wide settings, NOT tied to any app.
--
-- WHY: biz_app_config is keyed by (facility_id, app_id, config_key) and is for
-- per-app settings. Some preferences are global to the whole facility (e.g. the
-- "AI Assist" opt-out that gates the Marketing Tools AI generators), which have
-- no app_id to hang off. This table holds those, keyed by (facility_id,
-- config_key). Edited in App Config → General Settings (AppConfigClient).
--
-- RLS mirrors biz_app_config's tenant model:
--   • READ  — any user in the row's facility (the ai-generate route reads the
--             AI Assist flag as a regular user, so reads can't be admin-only).
--   • WRITE — facility-admin (is_facility_admin(): a super_user in the row's
--             facility) or platform operator (is_master_control()).
--
-- Run this once in the Supabase SQL editor (it is not auto-applied by deploys).

create table if not exists biz_facility_config (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references facilities (id) on delete cascade,
  config_key   text not null,
  config_value text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (facility_id, config_key)
);

alter table biz_facility_config enable row level security;

-- READ: anyone in the facility (or master_control) may read its settings.
drop policy if exists biz_facility_config_select on biz_facility_config;
create policy biz_facility_config_select on biz_facility_config
  for select
  using (facility_id = get_user_facility_id() or is_master_control());

-- INSERT: facility-admin writing into their OWN facility, or master_control.
drop policy if exists biz_facility_config_insert on biz_facility_config;
create policy biz_facility_config_insert on biz_facility_config
  for insert
  with check ((facility_id = get_user_facility_id() and is_facility_admin()) or is_master_control());

-- UPDATE: facility-admin of the row's OWN facility, or master_control.
drop policy if exists biz_facility_config_update on biz_facility_config;
create policy biz_facility_config_update on biz_facility_config
  for update
  using ((facility_id = get_user_facility_id() and is_facility_admin()) or is_master_control())
  with check ((facility_id = get_user_facility_id() and is_facility_admin()) or is_master_control());

-- DELETE: facility-admin of the row's OWN facility, or master_control.
drop policy if exists biz_facility_config_delete on biz_facility_config;
create policy biz_facility_config_delete on biz_facility_config
  for delete
  using ((facility_id = get_user_facility_id() and is_facility_admin()) or is_master_control());
