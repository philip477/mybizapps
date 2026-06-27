'use client'

import { useRouter } from 'next/navigation'
import { APP_VERSION } from '@/lib/version'
import { supabase } from '@/lib/supabase'

// Renders an app_icon that may be an emoji, an image URL, or empty.
function AppIcon({ icon, fallback = '📦' }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return (
      <img
        src={icon}
        alt=""
        style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8 }}
      />
    )
  }
  return <span style={{ fontSize: 38, lineHeight: 1 }}>{icon || fallback}</span>
}

function Tile({ icon, name, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 8px',
        background: '#fff',
        border: '1.5px solid #d0e0f4',
        borderRadius: 12,
        cursor: 'pointer',
        minHeight: 104,
        fontFamily: 'inherit',
      }}
    >
      <AppIcon icon={icon} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#1a56a0',
          textAlign: 'center',
          lineHeight: 1.15,
        }}
      >
        {name}
      </span>
    </button>
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

      {/* Tile grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          padding: 12,
        }}
      >
        {/* My Info — always first. */}
        <Tile icon="👤" name="My Info" onClick={() => router.push('/my-account')} />

        {navItems
          .filter((app) => app.app_link !== '/my-account')
          .map((app) => (
            <Tile
              key={app.id || app.app_link}
              icon={app.app_icon}
              name={app.app_name}
              onClick={() => openApp(app)}
            />
          ))}
      </div>

      {navItems.length === 0 && (
        <div
          style={{
            padding: '0 12px 16px',
            color: '#5580a0',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          No apps have been configured for your facility yet.
        </div>
      )}
    </div>
  )
}
