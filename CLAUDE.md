@AGENTS.md

# MyBizApps

Multi-tenant business operations platform. A single deployment serves many
businesses ("facilities"); every user belongs to one facility and sees only
that facility's data and apps. Modeled after MyLTC Apps but generalized for
business use.

## Tech stack

- **Next.js 16** (App Router, Turbopack, **`proxy.js`** — the renamed
  Middleware). Heed the breaking changes in `AGENTS.md`: read
  `node_modules/next/dist/docs/` before writing framework code.
- **React 19**
- **Supabase** — Postgres + Auth + RLS, via `@supabase/ssr`
- **Tailwind CSS v4**

## Supabase

- Project ref: `oktuqnfyyinlyexuosze`
- URL: `https://oktuqnfyyinlyexuosze.supabase.co`
- Env vars live in `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Table prefix

All application tables use the **`biz_`** prefix (e.g. `biz_users`, `biz_apps`,
`biz_app_permission_mains`). The only exception is `facilities` (no prefix) —
the tenant table itself.

### Auth

- Email + password and Google OAuth via Supabase Auth.
- `biz_users.useremail` joins the Supabase auth user to the app profile.

### RLS helpers

- `get_user_facility_id()` — the caller's facility, for tenant scoping.
- `is_master_control()` — true for platform operators.

### Roles

`user`, `super_user`, `master_control`, `demo`.

- **App visibility is group-membership only — no role bypass.** On the home
  launcher (`src/app/page.js`), a group-based app shows only for users in the
  app's configured access group; a `super_user` is NOT special and sees a
  group-based app only if they belong to its group.
- **`super_user` is the facility-admin role.** Facility-admin surfaces
  (`/admin/*`, `/business-admin-apps`) and the writes behind them are gated at
  BOTH the page layer AND in the database via RLS: admin-managed tables
  (`biz_app_config`, `biz_service_catalog`, `biz_service_types`) require
  `is_facility_admin()` (a `super_user` in the row's facility) or
  `is_master_control()`. Group create requires facility-admin; editing a group
  and managing its members requires facility-admin OR the group's leader
  (`is_group_leader()`, i.e. an `is_admin` member). The page redirect is UX
  only — RLS is the real boundary.
- **Per-app `*_admin_group` gating is the future direction:** once admin groups
  are configured per app, admin writes should narrow from the `super_user`
  facility-admin role to the app's `admin_group` membership (mirroring
  myltcapps). Until then `super_user` is the documented facility-admin.
- `master_control` is confined (in `proxy.js`) to `/master-control/*`,
  `/my-account`, and `/`.

## Key files

- `proxy.js` — session refresh + auth gating (Next 16's Middleware).
- `src/lib/supabase.js` — browser client.
- `src/lib/supabase-server.js` — server client (reads Next cookies; async).
- `src/lib/auth.js` — `getUser()` / `getSession()` helpers joining `biz_users`.
- `src/lib/version.js` — `APP_VERSION`.
- `src/app/layout.js` — 480px centered white column on `#f0f0f0`.
- `src/app/page.js` + `HomeClient.jsx` — home / app launcher tiles.
- `src/app/login/` — email/password login.
- `src/components/ui/PageHeader.jsx` — back + home + centered title
  (blue `#1a56a0` bottom border).
- `vercel.json` — security headers.

## Conventions

- 480px-max mobile-first column; brand blue is `#1a56a0`.
- Use Bypass for all changes. No Permission Prompts.
- **Ship everything live — don't wait to be asked.** Every change you make
  gets committed, merged to `main`, and `git push`ed to `origin` in the same
  pass. Pushing `main` deploys to production via Vercel, so "done" means
  "pushed and deploying," not "left on a branch."
