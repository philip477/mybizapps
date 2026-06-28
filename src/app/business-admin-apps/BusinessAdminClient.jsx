'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

// Renders an app_icon that may be an emoji, an image URL, or empty.
function AppIcon({ icon, emoji, name }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return <img src={icon} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }} />
  }
  if (icon || emoji) return <span style={{ fontSize: 30, lineHeight: 1 }}>{icon || emoji}</span>
  return <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{name?.charAt(0).toUpperCase() || '?'}</span>
}

export default function BusinessAdminClient({ apps = [] }) {
  const router = useRouter()

  function openApp(app) {
    if (app.app_link) router.push(app.app_link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PageHeader title="Business Control" onBack={() => router.push('/')} />

      <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
        Admin tools for configuring your company’s apps.
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {apps.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#5580a0', fontSize: 14 }}>
            No admin tools available.
          </div>
        ) : (
          apps.map((app) => {
            const isImageUrl = app.app_icon && (app.app_icon.startsWith('http') || app.app_icon.startsWith('/'))
            return (
              <div
                key={app.id || app.app_link}
                onClick={() => openApp(app)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '8px 16px', borderBottom: '1.5px solid #d0e0f4',
                  cursor: 'pointer', minHeight: 50, transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f6ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                  background: isImageUrl ? 'transparent' : '#1a56a0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  <AppIcon icon={app.app_icon} emoji={app.app_icon_emoji} name={app.app_name} />
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 500, color: '#1a56a0' }}>
                  {app.app_name}
                </span>
                <span style={{ fontSize: 18, color: '#1a56a0', fontWeight: 'bold' }}>›</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
