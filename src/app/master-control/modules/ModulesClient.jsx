'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

// Inline styles throughout (no styled-jsx) so the card layout renders reliably
// in every build target — this mirrors the MyLTC Apps Module Builder.
const NAV = '#1a56a0'
const MUTED = '#5580a0'
const BORDER = '#d0e0f4'
const GREEN = '#1a7a42'
const GREEN_BG = '#dcf5e8'
const GOLD = '#856404'
const GOLD_BG = '#fff3cd'

// Base Platform yearly price — mirrors BASE_COST on the public /price-sheet.
const BASE_YEARLY = 1000
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US')
// Month-to-month: annual ÷ 12 + 10% (matches fmtMo on /price-sheet).
const perMonth = (n) =>
  '$' + Math.round((Number(n || 0) / 12) * 1.1).toLocaleString('en-US')

const isUrl = (s) => s && (s.startsWith('http') || s.startsWith('/'))

function Badge({ text, bg, color }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '2px 8px',
        borderRadius: 10,
        background: bg,
        color,
        flexShrink: 0,
      }}
    >
      {text}
    </span>
  )
}

export default function ModulesClient({ initialModules = [], appIcon = '', appName = '' }) {
  const router = useRouter()
  const base = initialModules.filter((m) => m.is_base)
  const addons = initialModules.filter((m) => !m.is_base)

  function ModuleCard(m) {
    const active = m.active !== false
    return (
      <div
        key={m.id}
        onClick={() => router.push(`/master-control/modules/${m.id}`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          marginBottom: 8,
          border: `1.5px solid ${active ? BORDER : '#f5b3b3'}`,
          borderRadius: 8,
          background: active ? '#fff' : '#fef2f2',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f6ff')}
        onMouseLeave={(e) => (e.currentTarget.style.background = active ? '#fff' : '#fef2f2')}
      >
        {isUrl(m.icon) ? (
          <img src={m.icon} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{m.icon || '📦'}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: NAV }}>{m.name}</span>
            {m.is_base ? (
              <Badge text="Included" bg={GREEN_BG} color={GREEN} />
            ) : (
              <Badge text="Add-On" bg={GOLD_BG} color={GOLD} />
            )}
            {!active && <span style={{ fontSize: 9, color: '#b02020', fontWeight: 700 }}>INACTIVE</span>}
          </div>
          {m.description && <div style={{ fontSize: 12, color: MUTED }}>{m.description}</div>}
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {m.is_base
              ? 'Included in Base Platform'
              : `${money(m.price_yearly)}/yr · ${perMonth(m.price_yearly)}/mo`}
          </div>
        </div>
        <span style={{ color: NAV, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>›</span>
      </div>
    )
  }

  const sectionLabel = (text, color, mt = 0) => (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color,
        marginTop: mt,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {text}
    </div>
  )

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <PageHeader title={appName || 'Modules'} appIcon={appIcon || '📦'} />

      {/* Toolbar — green add button + module count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: `1.5px solid ${BORDER}` }}>
        <button
          onClick={() => router.push('/master-control/modules/new')}
          aria-label="Add module"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            flexShrink: 0,
            background: '#1a8050',
            color: '#fff',
            border: 'none',
            fontSize: 30,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
        <div style={{ flex: 1, fontSize: 13, color: MUTED }}>
          {initialModules.length} module{initialModules.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Base Platform highlight card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 16,
            border: `1.5px solid ${NAV}`,
            borderRadius: 8,
            background: '#f5f8ff',
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>⚙️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAV }}>Base Platform</div>
            <div style={{ fontSize: 12, color: MUTED }}>Includes the core modules below</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAV }}>{money(BASE_YEARLY)}/yr</div>
            <div style={{ fontSize: 12, color: MUTED }}>{perMonth(BASE_YEARLY)}/mo</div>
          </div>
        </div>

        {/* Base modules */}
        {sectionLabel('Included in Base Platform', NAV)}
        {base.length ? (
          base.map(ModuleCard)
        ) : (
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>No base modules yet</div>
        )}

        {/* Add-on modules */}
        {sectionLabel('Add-On Modules', GOLD, 20)}
        {addons.length ? (
          addons.map(ModuleCard)
        ) : (
          <div style={{ fontSize: 13, color: MUTED }}>No add-on modules yet</div>
        )}
      </div>
    </div>
  )
}
