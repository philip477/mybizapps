// App Config templates — the predefined, known config keys per app.
//
// App Config is template-driven: a super_user can only SET values for the keys
// declared here, never invent new ones. This mirrors how MyLTC pins its config
// surface to a fixed MODULES array rather than free-form key/value pairs.
//
// Keyed by app_link. Each entry is an array of field descriptors:
//   { key, label, type, help? }
// where `type` is one of:
//   'group'  — a biz_groups picker. Use for `*_admin_group` keys that wire an
//              app's admin group; there is no role bypass, so naming a group
//              here is how admin access for that app is granted.
//   'toggle' — an on/off boolean, stored as the string 'true' / 'false'.
//   'text'   — a free-text value.
//
// The group-gating config: every group-based app (see src/lib/homeApps.js) gets
// an `*_access_group` field here so a super_user can name the biz_group allowed
// to see that app on the home menu. This is the only thing that reveals a
// group-based app to a regular user — there is no role bypass — so naming a
// group here is how access is granted. Built from the shared GROUP_BASED_APPS
// list so the keys the super_user edits match the ones the home loader reads.
//
// Add further per-app fields by appending to the entry for that app_link — e.g.
//   '/tickets': [
//     { key: 'tickets_auto_close', label: 'Auto-close resolved tickets',
//       type: 'toggle' },
//   ],
import { GROUP_BASED_APPS } from '@/lib/homeApps'

// The access-group field every group-based app gets (see the note above).
const GROUP_FIELDS = Object.fromEntries(
  GROUP_BASED_APPS.map((a) => [
    a.app_link,
    [
      {
        key: a.config_key,
        label: 'Access Group',
        type: 'group',
        help: `Only members of this group see ${a.app_name} on their home menu.`,
      },
    ],
  ]),
)

// Per-app settings beyond access-group gating. An app may appear here in
// addition to GROUP_FIELDS; the two are merged below.
const EXTRA_FIELDS = {
  '/directory': [
    {
      key: 'directory_show_extensions',
      label: 'Show Extensions tab',
      type: 'toggle',
      help: "When on, the Employee Directory includes an Extensions tab listing each employee's phone extension.",
    },
  ],
}

export const APP_CONFIG_TEMPLATES = (() => {
  const merged = { ...GROUP_FIELDS }
  for (const [appLink, fields] of Object.entries(EXTRA_FIELDS)) {
    merged[appLink] = [...(merged[appLink] || []), ...fields]
  }
  return merged
})()

// The template (array of field descriptors) for an app, or null if the app has
// no predefined config.
export function templateFor(appLink) {
  return APP_CONFIG_TEMPLATES[appLink] || null
}

// True when an app has at least one configurable field defined.
export function hasTemplate(appLink) {
  const t = templateFor(appLink)
  return Array.isArray(t) && t.length > 0
}
