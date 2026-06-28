-- Seed the Business Control (super_user) admin tools into biz_apps.
--
-- These are `Admin Only` apps surfaced on /business-admin-apps. The hub page
-- has a static fallback, but seeding these rows makes the list data-driven and
-- lets master_control manage them from Master Control → Apps.
--
-- Idempotent without assuming a unique index on app_link: each app is inserted
-- only when no row with that app_link already exists.

insert into biz_apps (app_name, app_link, app_icon_emoji, app_type, description, sort_order, active)
select 'App Config', '/admin/app-config', '⚙️', 'Admin Only',
       'Configure per-app settings (admin groups, feature toggles) for your company.', 10, true
where not exists (select 1 from biz_apps where app_link = '/admin/app-config');

insert into biz_apps (app_name, app_link, app_icon_emoji, app_type, description, sort_order, active)
select 'Assign Company Apps', '/admin/assign-apps', '🧩', 'Admin Only',
       'Choose which apps your company has and order them on the home launcher.', 20, true
where not exists (select 1 from biz_apps where app_link = '/admin/assign-apps');
