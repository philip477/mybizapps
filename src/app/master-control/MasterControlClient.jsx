'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

// Renders an app_icon that may be an image URL or an emoji, falling back to the
// app's emoji icon and finally its first initial.
function AppIcon({ icon, fallbackEmoji, name }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return <img src={icon} alt="" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 4 }} />
  }
  if (icon) return <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
  if (fallbackEmoji) return <span style={{ fontSize: 28, lineHeight: 1 }}>{fallbackEmoji}</span>
  return <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{name?.charAt(0).toUpperCase() || '?'}</span>
}

export default function MasterControlClient({ apps = [], appIcon = '', appName = '' }) {
  const router = useRouter()

  function openApp(app) {
    if (app.app_link) router.push(app.app_link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <PageHeader
        title={appName || 'Master Control'}
        appIcon={appIcon}
        onBack={() => router.push('/')}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {apps.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#5580a0', fontSize: 14 }}>
            No master control apps found.
          </div>
        ) : (
          apps.map((app) => (
            <div
              key={app.id || app.app_link}
              onClick={() => openApp(app)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '4px 16px',
                borderBottom: '1.5px solid #d0e0f4',
                cursor: 'pointer',
                minHeight: 50,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f6ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: app.app_icon || app.app_icon_emoji ? 'transparent' : '#1a56a0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <AppIcon icon={app.app_icon} fallbackEmoji={app.app_icon_emoji} name={app.app_name} />
              </div>
              <span style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 500, color: '#1a56a0' }}>
                {app.app_name}
              </span>
              <span style={{ fontSize: 18, color: '#1a56a0', fontWeight: 'bold' }}>›</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
