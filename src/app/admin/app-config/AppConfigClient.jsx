'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { templateFor, hasTemplate, FACILITY_SETTINGS } from './templates'

// App Config — per-facility app settings editor.
//
// This surface is template-driven, NOT free-form: a super_user can only set
// values for the predefined keys declared in ./templates.js. Each app with a
// template expands to reveal its fields, rendered by type — a biz_groups picker
// for `group` fields (the usual way to wire an app's admin group, since there
// is no role bypass), a toggle for `toggle` fields, and a text box otherwise.
//
// There are no templates defined yet, so the common case is the clean empty
// state below. Add entries to ./templates.js as real config needs arrive.

// Renders an app_icon that may be an emoji, an image URL, or empty.
function AppIcon({ icon, emoji, name }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return <img src={icon} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }} />
  }
  if (icon || emoji) return <span style={{ fontSize: 26, lineHeight: 1 }}>{icon || emoji}</span>
  return <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{name?.charAt(0).toUpperCase() || '?'}</span>
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1.5px solid #d0e0f4', borderRadius: 8, outline: 'none',
  fontSize: 15, color: '#1A1A2E', padding: '9px 12px',
  fontFamily: "'Segoe UI', Arial, sans-serif", background: '#fff',
}

export default function AppConfigClient({
  appName = 'App Config',
  facilityId = null,
  initialApps = [],
  initialConfig = [],
  initialGroups = [],
  initialFacilityConfig = [],
}) {
  const router = useRouter()
  const [groups] = useState(initialGroups)

  // Only apps that have a predefined template are configurable here. Each gets
  // its field descriptors attached for rendering.
  const configurableApps = useMemo(
    () =>
      (initialApps || [])
        .filter((a) => hasTemplate(a.app_link))
        .map((a) => ({ ...a, template: templateFor(a.app_link) })),
    [initialApps],
  )

  // Config state, keyed by appId → { key → value }. Row ids (for in-place
  // updates) are tracked separately so we update by id when one exists and
  // insert otherwise. Only keys present in an app's template are kept.
  const [values, setValues] = useState(() => {
    const allowed = {}
    for (const a of configurableApps) {
      allowed[a.id] = new Set((a.template || []).map((f) => f.key))
    }
    const v = {}
    for (const r of initialConfig) {
      if (!allowed[r.app_id]?.has(r.config_key)) continue
      if (!v[r.app_id]) v[r.app_id] = {}
      v[r.app_id][r.config_key] = r.config_value ?? ''
    }
    return v
  })
  const [rowIds, setRowIds] = useState(() => {
    const m = {}
    for (const r of initialConfig) {
      if (!m[r.app_id]) m[r.app_id] = {}
      m[r.app_id][r.config_key] = r.id
    }
    return m
  })

  // Facility-wide settings (biz_facility_config) — global to the facility, not
  // tied to any app. Seeded from initialFacilityConfig, with each field's
  // `default` filling in keys that have no row yet (e.g. AI Assist defaults on).
  const [facilityValues, setFacilityValues] = useState(() => {
    const v = {}
    for (const r of initialFacilityConfig) v[r.config_key] = r.config_value ?? ''
    for (const f of FACILITY_SETTINGS) {
      if (v[f.key] === undefined && f.default !== undefined) v[f.key] = f.default
    }
    return v
  })
  const [facilityRowIds, setFacilityRowIds] = useState(() => {
    const m = {}
    for (const r of initialFacilityConfig) m[r.config_key] = r.id
    return m
  })
  const [savingFacility, setSavingFacility] = useState(false)

  const [expanded, setExpanded] = useState(() => new Set())
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState(null)

  const groupName = useMemo(() => {
    const m = {}
    for (const g of groups) m[g.id] = g.name
    return m
  }, [groups])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  function toggleExpanded(appId) {
    setExpanded((prev) => {
      const s = new Set(prev)
      s.has(appId) ? s.delete(appId) : s.add(appId)
      return s
    })
  }

  function setValue(appId, key, value) {
    setValues((prev) => ({ ...prev, [appId]: { ...(prev[appId] || {}), [key]: value } }))
  }

  function valueOf(appId, key) {
    return (values[appId] || {})[key] ?? ''
  }

  function facilityValueOf(key) {
    return facilityValues[key] ?? ''
  }

  function setFacilityValue(key, value) {
    setFacilityValues((prev) => ({ ...prev, [key]: value }))
  }

  // Persist the facility-wide settings to biz_facility_config. Mirrors saveApp:
  // update by row id when one exists, insert otherwise (no unique index assumed).
  async function saveFacilitySettings() {
    if (!facilityId) return
    setSavingFacility(true)
    try {
      for (const field of FACILITY_SETTINGS) {
        const key = field.key
        const value = facilityValues[key] ?? field.default ?? ''
        const id = facilityRowIds[key]
        if (id) {
          const { error } = await supabase
            .from('biz_facility_config')
            .update({ config_value: value })
            .eq('id', id)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('biz_facility_config')
            .insert({ facility_id: facilityId, config_key: key, config_value: value })
            .select('id')
            .single()
          if (error) throw error
          setFacilityRowIds((prev) => ({ ...prev, [key]: data.id }))
        }
      }
      showToast('Settings saved')
    } catch (err) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSavingFacility(false)
    }
  }

  async function saveApp(app) {
    if (!facilityId) return
    setSaving(app.id)
    try {
      // Persist exactly the template's keys — nothing else can be written.
      for (const field of app.template || []) {
        const key = field.key
        const value = valueOf(app.id, key)
        const id = (rowIds[app.id] || {})[key]
        if (id) {
          const { error } = await supabase
            .from('biz_app_config')
            .update({ config_value: value })
            .eq('id', id)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('biz_app_config')
            .insert({ facility_id: facilityId, app_id: app.id, config_key: key, config_value: value })
            .select('id')
            .single()
          if (error) throw error
          setRowIds((prev) => ({ ...prev, [app.id]: { ...(prev[app.id] || {}), [key]: data.id } }))
        }
      }
      showToast('Settings saved')
    } catch (err) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(null)
    }
  }

  // Renders one field by its declared type. Generic over where the value lives:
  // the caller supplies the current value and an onChange(newValue) handler, so
  // the same renderer serves both per-app and facility-wide settings.
  function renderField(field, value, onChange) {
    if (field.type === 'group') {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">— select a group —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          {/* Preserve a stored value that no longer matches a known group. */}
          {value && !groupName[value] && <option value={value}>(unknown group)</option>}
        </select>
      )
    }
    if (field.type === 'toggle') {
      const on = value === 'true'
      return (
        <button
          type="button"
          onClick={() => onChange(on ? 'false' : 'true')}
          aria-pressed={on}
          style={{
            position: 'relative', width: 52, height: 30, borderRadius: 15, border: 'none',
            background: on ? '#1a56a0' : '#c8d6e5', cursor: 'pointer', transition: 'background 0.15s',
            padding: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      )
    }
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    )
  }

  const toastEl = toast && (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: toast.type === 'error' ? '#b02020' : '#1a7a42',
      color: '#fff', padding: '10px 24px', borderRadius: 8,
      fontSize: 14, fontWeight: 600, zIndex: 999,
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
    }}>
      {toast.msg}
    </div>
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#fff', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={appName} onBack={() => router.push('/business-admin-apps')} />

      <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
        Configure the predefined settings for your company's apps.
      </div>

      <div style={{ padding: '12px' }}>
        {/* General Settings — facility-wide toggles (biz_facility_config), shown
            above the per-app configs since they apply to the whole company. */}
        {FACILITY_SETTINGS.length > 0 && (
          <div style={{ marginBottom: 14, border: '1.5px solid #d0e0f4', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f0f6ff' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: '#1a56a0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>
                🛠️
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0' }}>General Settings</div>
                <div style={{ fontSize: 12, color: '#5580a0', marginTop: 2 }}>Company-wide preferences</div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1.5px solid #d0e0f4' }}>
              {FACILITY_SETTINGS.map((field) => (
                <div key={field.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>
                    {field.label || field.key}
                  </label>
                  {renderField(field, facilityValueOf(field.key), (v) => setFacilityValue(field.key, v))}
                  {field.help && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>{field.help}</div>
                  )}
                </div>
              ))}
              <button
                onClick={saveFacilitySettings}
                disabled={savingFacility}
                style={{
                  width: '100%', marginTop: 4, background: savingFacility ? '#a0b8d0' : '#1a56a0',
                  color: '#fff', border: 'none', borderRadius: 8, padding: '13px 0',
                  fontSize: 15, fontWeight: 700, cursor: savingFacility ? 'not-allowed' : 'pointer',
                }}
              >
                {savingFacility ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {configurableApps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#5580a0', fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚙️</div>
            No app configurations available yet. Configuration options will appear
            here as apps are set up.
          </div>
        ) : (
          configurableApps.map((app) => {
            const isOpen = expanded.has(app.id)
            const fields = app.template || []
            return (
              <div key={app.id} style={{ marginBottom: 10, border: '1.5px solid #d0e0f4', borderRadius: 10, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleExpanded(app.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', background: isOpen ? '#f0f6ff' : '#fff' }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    background: app.app_icon && (app.app_icon.startsWith('http') || app.app_icon.startsWith('/')) ? 'transparent' : '#1a56a0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    <AppIcon icon={app.app_icon} emoji={app.app_icon_emoji} name={app.app_name} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0' }}>{app.app_name}</div>
                    <div style={{ fontSize: 12, color: '#5580a0', marginTop: 2 }}>
                      {fields.length} setting{fields.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: '#1a56a0' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={{ padding: '12px 14px', borderTop: '1.5px solid #d0e0f4' }}>
                    {fields.map((field) => (
                      <div key={field.key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>
                          {field.label || field.key}
                        </label>
                        {renderField(field, valueOf(app.id, field.key), (v) => setValue(app.id, field.key, v))}
                        {field.help && (
                          <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>{field.help}</div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => saveApp(app)}
                      disabled={saving === app.id}
                      style={{
                        width: '100%', marginTop: 4, background: saving === app.id ? '#a0b8d0' : '#1a56a0',
                        color: '#fff', border: 'none', borderRadius: 8, padding: '13px 0',
                        fontSize: 15, fontWeight: 700, cursor: saving === app.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {saving === app.id ? 'Saving…' : 'Save Settings'}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      {toastEl}
    </div>
  )
}
