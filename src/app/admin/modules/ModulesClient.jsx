'use client'

import { useState, useMemo } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const NAV = '#1a56a0'
const MUTED = '#5580a0'
const BORDER = '#d0e0f4'
const GREEN = '#1a8050'

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US')
// Month-to-month: annual ÷ 12 + 10% (matches the Modules catalog display).
const perMonth = (n) => '$' + Math.round((Number(n || 0) / 12) * 1.1).toLocaleString('en-US')
const isUrl = (s) => s && (s.startsWith('http') || s.startsWith('/'))

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      title={disabled ? 'Included in the Base Platform' : undefined}
      style={{
        width: 48, height: 26, borderRadius: 13,
        background: checked ? GREEN : '#ccc',
        position: 'relative', cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0, transition: 'background 0.2s', opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
      }} />
    </div>
  )
}

function Badge({ base }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
      padding: '2px 8px', borderRadius: 10,
      background: base ? '#dcf5e8' : '#fff3cd',
      color: base ? '#1a7a42' : '#856404',
    }}>
      {base ? 'Included' : 'Add-On'}
    </span>
  )
}

function ModuleCard({ mod, enabled, apps, saving, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const appCount = apps.length
  const isPaid = !mod.is_base && Number(mod.price_yearly) > 0

  return (
    <div style={{
      marginBottom: 8,
      border: `1.5px solid ${enabled ? GREEN : BORDER}`,
      borderRadius: 8, background: enabled ? '#f0fdf4' : '#fff', transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        {isUrl(mod.icon) ? (
          <img src={mod.icon} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{mod.icon || '📦'}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: NAV }}>{mod.name}</span>
            <Badge base={mod.is_base} />
          </div>
          {mod.description && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.3 }}>{mod.description}</div>}
          <div style={{ fontSize: 11, color: MUTED, marginTop: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {appCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                style={{ background: 'transparent', border: 'none', padding: 0, color: NAV, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {appCount} app{appCount !== 1 ? 's' : ''}
                <span style={{ fontSize: 9 }}>{expanded ? '▴' : '▾'}</span>
              </button>
            ) : (
              <span>0 apps</span>
            )}
            {isPaid && (
              <>
                <span style={{ fontWeight: 700, color: '#856404', background: '#fff3cd', padding: '2px 6px', borderRadius: 6 }}>{money(mod.price_yearly)}/yr</span>
                <span style={{ fontWeight: 700, color: '#856404', background: '#fff3cd', padding: '2px 6px', borderRadius: 6 }}>{perMonth(mod.price_yearly)}/mo</span>
              </>
            )}
          </div>
        </div>
        <ToggleSwitch checked={enabled} onChange={(v) => onToggle(v)} disabled={saving || mod.is_base} />
      </div>

      {expanded && appCount > 0 && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 16px 12px', background: enabled ? 'rgba(26,128,80,0.04)' : '#fafcff' }}>
          {apps.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', color: NAV, borderBottom: `1px solid ${BORDER}` }}>
              {isUrl(a.app_icon) ? (
                <img src={a.app_icon} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: 18, width: 22, textAlign: 'center', flexShrink: 0 }}>{a.app_icon_emoji || '📦'}</span>
              )}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{a.app_name}</span>
              {a.app_type === 'Admin Only' && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#856404', background: '#fff3cd', padding: '1px 6px', borderRadius: 8 }}>Admin</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModulesClient({ appIcon = '', appName = 'Manage Modules', facilityId = null, modules = [], facilityModules = [], apps = [] }) {
  const [facMods, setFacMods] = useState(facilityModules)
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const appsByModule = useMemo(() => {
    const m = {}
    for (const a of apps) {
      if (!m[a.module_id]) m[a.module_id] = []
      m[a.module_id].push(a)
    }
    return m
  }, [apps])

  function isEnabled(mod) {
    const fm = facMods.find((f) => f.module_id === mod.id)
    if (fm) return fm.enabled
    return !!mod.is_base
  }

  async function toggleModule(mod, newValue) {
    if (mod.is_base) return // base platform modules are always on
    const isPaid = Number(mod.price_yearly) > 0
    if (newValue && isPaid) {
      if (!window.confirm(`Enable ${mod.name}? This adds ${money(mod.price_yearly)}/yr to your plan.`)) return
    } else if (!newValue) {
      if (!window.confirm(`Disable ${mod.name} for your company?`)) return
    }

    setSaving(mod.id)
    try {
      const existing = facMods.find((f) => f.module_id === mod.id)
      if (existing) {
        const { error } = await supabase
          .from('biz_facility_modules')
          .update({ enabled: newValue })
          .eq('facility_id', facilityId)
          .eq('module_id', mod.id)
        if (error) throw error
        setFacMods((prev) => prev.map((f) => (f.module_id === mod.id ? { ...f, enabled: newValue } : f)))
      } else {
        const { error } = await supabase
          .from('biz_facility_modules')
          .insert({ facility_id: facilityId, module_id: mod.id, enabled: newValue })
        if (error) throw error
        setFacMods((prev) => [...prev, { module_id: mod.id, enabled: newValue }])
      }
      showToast(newValue ? `${mod.name} enabled` : `${mod.name} disabled`)
    } catch (err) {
      showToast(err.message || 'Could not update module', 'error')
    } finally {
      setSaving(null)
    }
  }

  // Base modules first within each group; modules already arrive in sort_order.
  const rank = (m) => (m.is_base ? 0 : 1)
  const enabled = modules.filter(isEnabled).sort((a, b) => rank(a) - rank(b))
  const available = modules.filter((m) => !isEnabled(m)).sort((a, b) => rank(a) - rank(b))

  const card = (mod) => (
    <ModuleCard
      key={mod.id}
      mod={mod}
      enabled={isEnabled(mod)}
      apps={appsByModule[mod.id] || []}
      saving={saving === mod.id}
      onToggle={(v) => toggleModule(mod, v)}
    />
  )

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <PageHeader title={appName} appIcon={appIcon} onBack={() => { window.location.href = '/business-admin-apps' }} />

      <div style={{ padding: '12px 16px', background: '#f5f8ff', borderBottom: `1.5px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, color: MUTED }}>
          {enabled.length} of {modules.length} module{modules.length !== 1 ? 's' : ''} enabled
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7a42', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Your Modules ({enabled.length})
        </div>
        {enabled.length === 0 ? (
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, padding: '12px 14px', background: '#f5f8ff', borderRadius: 8 }}>
            No modules enabled yet — add one from the list below.
          </div>
        ) : (
          enabled.map(card)
        )}

        {available.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Additional Modules ({available.length})
            </div>
            {available.map(card)}
          </>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#b02020' : GREEN, color: '#fff',
          padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, zIndex: 999,
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)', maxWidth: '90%', textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
