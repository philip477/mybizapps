// Home menu app model — the "My Apps" pattern, adapted from MyLTC Apps.
//
// MyBizApps has few apps, so the home launcher doesn't need a separate "My Apps"
// screen the way MyLTC does. Instead the single home menu splits its apps into
// two tiers and filters them per user:
//
//   CORE_APPS      — always visible to every user, regardless of group
//                    membership. The fundamentals everyone needs.
//   GROUP_BASED_APPS — shown only when the user belongs to the biz_group named
//                    in that app's `*_access_group` config (set by a super_user
//                    in App Config). A field tech sees Service Schedule + Work
//                    Tickets; an office manager sees Invoices + Accounting.
//
// super_users see everything (they administer it all). Apps in neither list are
// treated as additional and shown to everyone — we never hide an unknown app.
//
// This is the single source of truth shared by the home loader (src/app/page.js)
// and the App Config templates (src/app/admin/app-config/templates.js), so the
// `*_access_group` keys the super_user edits are exactly the ones the home menu
// reads back.

// Always-visible core apps, in the order they appear on the home menu.
// `emoji` is a fallback used when the biz_apps catalog row is missing.
export const CORE_APPS = [
  { app_link: '/my-account', app_name: 'My Info', emoji: '👤' },
  { app_link: '/my-tasks', app_name: 'My Tasks', emoji: '✅' },
  { app_link: '/my-groups', app_name: 'My Groups', emoji: '👥' },
  { app_link: '/directory', app_name: 'Employee Directory', emoji: '📇' },
  { app_link: '/my-tickets', app_name: 'Work Tickets', emoji: '🎫' },
]

// Group-based apps. `config_key` is the per-app App Config key (type `group`)
// whose value is the biz_group id allowed to see the app.
export const GROUP_BASED_APPS = [
  { app_link: '/customers', app_name: 'Customers', config_key: 'customers_access_group' },
  { app_link: '/invoices', app_name: 'Invoices & Quotes', config_key: 'invoices_access_group' },
  { app_link: '/accounting', app_name: 'Accounting', config_key: 'accounting_access_group' },
  { app_link: '/service-schedule', app_name: 'Service Schedule', config_key: 'service_schedule_access_group' },
  { app_link: '/alert-system', app_name: 'Alerts', config_key: 'alerts_access_group' },
  { app_link: '/on-call-calendar', app_name: 'On-Call Calendar', config_key: 'on_call_access_group' },
  { app_link: '/meetings', app_name: 'Meetings', config_key: 'meetings_access_group' },
  { app_link: '/reservations', app_name: 'Reservations', config_key: 'reservations_access_group' },
  { app_link: '/my-docs', app_name: 'My Docs', config_key: 'docs_access_group' },
  { app_link: '/marketing-tools', app_name: 'Marketing Tools', config_key: 'marketing_tools_access_group' },
]

// Lookups derived from the lists above.
export const ALWAYS_VISIBLE_LINKS = new Set(CORE_APPS.map((a) => a.app_link))
export const CORE_ORDER = Object.fromEntries(CORE_APPS.map((a, i) => [a.app_link, i]))
export const GROUP_BASED_BY_LINK = Object.fromEntries(
  GROUP_BASED_APPS.map((a) => [a.app_link, a]),
)
