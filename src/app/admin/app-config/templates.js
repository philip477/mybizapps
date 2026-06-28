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
// There are NO templates defined yet. As real config needs land, add an entry
// keyed by the app's app_link and its field(s) will appear in App Config — e.g.
//   '/tickets': [
//     { key: 'tickets_admin_group', label: 'Admin Group', type: 'group',
//       help: 'Members of this group administer Tickets.' },
//     { key: 'tickets_auto_close', label: 'Auto-close resolved tickets',
//       type: 'toggle' },
//   ],
export const APP_CONFIG_TEMPLATES = {}

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
