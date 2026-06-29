import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import HomeClient from './HomeClient'
import MarketingPage from './MarketingPage'
import {
  CORE_APPS,
  CORE_ORDER,
  ALWAYS_VISIBLE_LINKS,
  GROUP_BASED_BY_LINK,
} from '@/lib/homeApps'

// Home — server component. "/" is public: authenticated users get the app home
// (HomeClient), while unauthenticated visitors get the marketing landing page.
// proxy.js deliberately lets unauthenticated requests reach "/", so the auth
// branch is decided here rather than via a redirect.
export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  // The marketing landing page is shown ONLY when there is no auth session at
  // all. Anyone holding a valid session gets the app home below — even if their
  // biz_users profile lookup fails (missing row, RLS, transient error). We must
  // never bounce an authenticated user back to marketing/login from here.
  if (!authUser) return <MarketingPage />

  // Auto-link pre-provisioned users (admin-created biz_users row with a NULL
  // auth_id) to this auth identity before reading the profile. biz_users RLS
  // only exposes rows in the caller's own facility, which a brand-new user can't
  // resolve yet (get_user_facility_id() needs a linked row), so the lookup below
  // would fall back to a minimal profile (no role
  // or facility). link_auth_user is SECURITY DEFINER (bypasses RLS), idempotent,
  // and only fills a NULL auth_id matched by email. Best-effort: a missing DB
  // function must not break the home page.
  if (authUser.email) {
    try {
      await supabase.rpc('link_auth_user', {
        p_auth_id: authUser.id,
        p_email: authUser.email,
      })
    } catch {
      // Network/transient failure — linking is best-effort; don't break home.
    }
  }

  // App-level profile. A null result is tolerated: we fall back to a minimal
  // profile derived from the auth user so the app home still renders.
  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('*')
    // Escape ILIKE wildcards so the email matches literally, not as a pattern.
    .ilike('email', (authUser.email || '').replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()

  // master_control operators get the Master Control dashboard, not the regular
  // facility app launcher. (proxy.js already confines them to /master-control,
  // /my-account and "/", so this is the only place "/" needs to branch.)
  if (bizUser?.user_role === 'master_control') {
    redirect('/master-control')
  }

  const fid = bizUser?.facility_id ?? null

  // Facility (for the header logo + name). `facilities` has no biz_ prefix.
  const { data: facility } = fid
    ? await supabase
        .from('facilities')
        .select('id, company_name, company_logo')
        .eq('id', fid)
        .maybeSingle()
    : { data: null }

  const role = bizUser?.user_role ?? 'user'

  // The home menu follows the "My Apps" pattern (see src/lib/homeApps.js): core
  // apps show for everyone; group-based apps show only for users who are members
  // of the app's configured access group. No role bypass — a super_user sees a
  // group-based app only if they're in its group (admin tooling lives elsewhere).
  // We load four things in parallel:
  //   perms        — the facility's assigned apps (Assign Company Apps), ordered
  //   memberships  — the caller's biz_group ids (for group gating)
  //   accessCfg    — each app's `*_access_group` value (app_id → group_id)
  //   allActive    — the full active catalog (fallback + core-app metadata)
  const APP_SELECT = 'id, app_name, app_icon, app_icon_emoji, app_link, app_type, active'
  let coreApps = []
  let groupApps = []

  if (fid) {
    const [{ data: perms }, { data: memberships }, { data: accessCfg }, { data: allActive }] =
      await Promise.all([
        supabase
          .from('biz_app_permission_mains')
          .select(`app_order, biz_apps(${APP_SELECT})`)
          .eq('facility_id', fid)
          .order('app_order'),
        bizUser?.id
          ? supabase.from('biz_group_members').select('group_id').eq('user_id', bizUser.id)
          : Promise.resolve({ data: [] }),
        supabase
          .from('biz_app_config')
          .select('app_id, config_key, config_value')
          .eq('facility_id', fid)
          .ilike('config_key', '%access_group%'),
        supabase
          .from('biz_apps')
          .select(APP_SELECT)
          .eq('active', true)
          .eq('app_type', 'User App')
          .order('app_name'),
      ])

    const userGroupIds = new Set((memberships || []).map((m) => m.group_id))

    // app_id → access-group id (only when a group is actually set).
    const accessGroupByApp = {}
    for (const c of accessCfg || []) {
      if (c.config_value) accessGroupByApp[c.app_id] = c.config_value
    }

    // The facility's enabled apps (assigned set, or the whole active catalog on
    // a fresh facility with no permission rows yet).
    const catalog = allActive || []
    const catalogByLink = {}
    for (const a of catalog) catalogByLink[a.app_link] = a

    let universe = (perms || [])
      .map((p) => (Array.isArray(p.biz_apps) ? p.biz_apps[0] : p.biz_apps))
      .filter((a) => a && a.active && (!a.app_type || a.app_type === 'User App'))
    if (universe.length === 0) universe = catalog

    // Core apps are fundamental — inject any that the facility hasn't explicitly
    // assigned, pulling real metadata from the catalog when present.
    const seen = new Set(universe.map((a) => a.app_link))
    for (const core of CORE_APPS) {
      if (seen.has(core.app_link)) continue
      universe.push(
        catalogByLink[core.app_link] || {
          id: core.app_link,
          app_name: core.app_name,
          app_link: core.app_link,
          app_icon: null,
          app_icon_emoji: core.emoji,
          active: true,
        },
      )
      seen.add(core.app_link)
    }

    // Split into the two tiers, filtering group-based apps by membership.
    for (const app of universe) {
      if (ALWAYS_VISIBLE_LINKS.has(app.app_link)) {
        coreApps.push(app)
        continue
      }
      const gb = GROUP_BASED_BY_LINK[app.app_link]
      if (gb) {
        const grp = accessGroupByApp[app.id]
        if (grp && userGroupIds.has(grp)) groupApps.push(app)
        continue
      }
      // Unknown app — never hide it. Show alongside the group-based tier.
      groupApps.push(app)
    }

    // Order core apps by the canonical CORE_APPS order; keep the assigned order
    // (app_order) for everything else.
    coreApps.sort(
      (a, b) => (CORE_ORDER[a.app_link] ?? 99) - (CORE_ORDER[b.app_link] ?? 99),
    )
  }

  // super_users administer the facility, so surface the Business Control hub
  // (App Config, Assign Company Apps, …) on their home menu. Those are
  // `Admin Only` apps, which never flow through the User App launcher above, so
  // there's otherwise no way to reach company config from home. The page itself
  // re-checks the role (RLS is the real boundary); a missing catalog row falls
  // back to the built-in hub tile so the entry point is never lost.
  let adminApps = []
  if (role === 'super_user') {
    const { data: hub } = await supabase
      .from('biz_apps')
      .select(APP_SELECT)
      .eq('app_type', 'Admin Only')
      .eq('app_link', '/business-admin-apps')
      .eq('active', true)
      .maybeSingle()
    adminApps = hub
      ? [hub]
      : [{
          id: 'business-admin-apps',
          app_name: 'Business Control',
          app_link: '/business-admin-apps',
          app_icon: null,
          app_icon_emoji: '⚙️',
          active: true,
        }]
  }

  const user = {
    id: bizUser?.id ?? authUser.id,
    email: bizUser?.email ?? authUser.email,
    full_name: `${bizUser?.first_name || ''} ${bizUser?.last_name || ''}`.trim(),
    first_name: bizUser?.first_name ?? null,
    last_name: bizUser?.last_name ?? null,
    role,
    facility_id: fid,
  }

  return (
    <HomeClient
      user={user}
      facility={facility}
      coreApps={coreApps}
      groupApps={groupApps}
      adminApps={adminApps}
    />
  )
}
