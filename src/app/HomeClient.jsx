'use client'

import { useRouter } from 'next/navigation'
import { APP_VERSION } from '@/lib/version'
import { supabase } from '@/lib/supabase'

// Renders an app_icon that may be an emoji, an image URL, or empty. Sized to
// sit inside a ~44px square on each list row.
function AppIcon({ icon, fallback = '📦' }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return (
      <img
        src={icon}
        alt=""
        style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }}
      />
    )
  }
  return <span style={{ fontSize: 30, lineHeight: 1 }}>{icon || fallback}</span>
}

// A single tappable app row: icon square on the left, name, right chevron, with
// a thin divider underneath. Mirrors the MyLTC Apps home list.
function AppRow({ icon, fallback, name, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 16px',
        borderBottom: '1.5px solid #d0e0f4',
        cursor: 'pointer',
        minHeight: 50,
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f6ff')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 6,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <AppIcon icon={icon} fallback={fallback} />
      </div>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 18,
          fontWeight: 500,
          color: '#1a56a0',
        }}
      >
        {name}
      </span>
      <span style={{ fontSize: 18, color: '#1a56a0', fontWeight: 'bold' }}>›</span>
    </div>
  )
}

export default function HomeClient({ user, facility, navItems = [] }) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function openApp(app) {
    if (app.app_link) router.push(app.app_link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px',
          borderBottom: '2px solid #1a56a0',
        }}
      >
        {facility?.company_logo ? (
          <img
            src={facility.company_logo}
            alt={facility.company_name || 'Logo'}
            width={50}
            height={50}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: '#1a56a0',
              flexShrink: 0,
            }}
          />
        )}
        <div
          style={{
            minWidth: 0,
            flex: 1,
            fontSize: 26,
            fontWeight: 700,
            color: '#1a56a0',
            lineHeight: 1.1,
          }}
        >
          {facility?.company_name || 'MyBizApps'}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <div style={{ color: '#5580a0', fontSize: 12, fontWeight: 600 }}>
            {APP_VERSION}
          </div>
          {user && (
            <div
              style={{
                color: '#1a56a0',
                fontSize: 12,
                fontWeight: 600,
                maxWidth: 120,
                textAlign: 'right',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.first_name || user.full_name || user.email}
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid #d0e0f4',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              color: '#5580a0',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* App list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* My Info — always first. */}
        <AppRow icon="👤" name="My Info" onClick={() => router.push('/my-account')} />

        {navItems
          .filter((app) => app.app_link !== '/my-account')
          .map((app) => (
            <AppRow
              key={app.id || app.app_link}
              icon={app.app_icon}
              fallback={app.app_icon_emoji || '📦'}
              name={app.app_name}
              onClick={() => openApp(app)}
            />
          ))}

        {navItems.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              color: '#5580a0',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            No apps have been configured for your facility yet.
          </div>
        )}
      </div>
    </div>
  )
}
