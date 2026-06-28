'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// App Config — per-facility app settings editor.
//
// Each assigned app expands to reveal its config key/value pairs. Keys ending
// in `_group` (e.g. `tickets_admin_group`) render a biz_group picker; the rest
// are plain text. Adding a key whose name ends in `_admin_group` is the common
// way to grant an app its admin group — there is no role bypass, so this is how
// admin access is wired.

const KEY_IS_GROUP = (key) => /_group$/.test(key || '')

// A best-effort, human-friendly label from a snake_case config key.
function keyLabel(key) {
  return (key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

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
}) {
  const router = useRouter()
  const [apps] = useState(initialApps)
  const [groups] = useState(initialGroups)

  // Config state, keyed by appId → { key → value }. Row ids (for in-place
  // updates) are tracked separately so we update by id when one exists and
  // insert otherwise.
  const [values, setValues] = useState(() => {
    const v = {}
    for (const r of initialConfig) {
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

  const [expanded, setExpanded] = useState(() => new Set())
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState(null)

  // New-key drafts, keyed by appId → { key, value }.
  const [drafts, setDrafts] = useState({})

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

  function setDraft(appId, patch) {
    setDrafts((prev) => ({ ...prev, [appId]: { ...(prev[appId] || { key: '', value: '' }), ...patch } }))
  }

  function keysFor(appId) {
    return Object.keys(values[appId] || {}).sort()
  }

  // Add the draft key into local state so it renders with the right editor; it
  // is persisted on the next Save.
  function addKey(appId) {
    const draft = drafts[appId] || {}
    const key = (draft.key || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!key) return
    if ((values[appId] || {})[key] !== undefined) { showToast('That key already exists', 'error'); return }
    setValue(appId, key, draft.value || '')
    setDraft(appId, { key: '', value: '' })
  }

  async function deleteKey(appId, key) {
    const id = (rowIds[appId] || {})[key]
    if (id) {
      const { error } = await supabase.from('biz_app_config').delete().eq('id', id)
      if (error) { showToast(error.message, 'error'); return }
    }
    setValues((prev) => {
      const next = { ...(prev[appId] || {}) }
      delete next[key]
      return { ...prev, [appId]: next }
    })
    setRowIds((prev) => {
      const next = { ...(prev[appId] || {}) }
      delete next[key]
      return { ...prev, [appId]: next }
    })
    showToast('Setting removed')
  }

  async function saveApp(appId) {
    if (!facilityId) return
    setSaving(appId)
    try {
      const keys = keysFor(appId)
      for (const key of keys) {
        const value = (values[appId] || {})[key] ?? ''
        const id = (rowIds[appId] || {})[key]
        if (id) {
          const { error } = await supabase
            .from('biz_app_config')
            .update({ config_value: value })
            .eq('id', id)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('biz_app_config')
            .insert({ facility_id: facilityId, app_id: appId, config_key: key, config_value: value })
            .select('id')
            .single()
          if (error) throw error
          setRowIds((prev) => ({ ...prev, [appId]: { ...(prev[appId] || {}), [key]: data.id } }))
        }
      }
      showToast('Settings saved')
    } catch (err) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(null)
    }
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
        Configure per-app settings for your company. Keys ending in <code style={{ color: '#1a56a0' }}>_group</code> pick an admin group.
      </div>

      <div style={{ padding: '12px' }}>
        {apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#5580a0', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚙️</div>
            No apps are assigned to your company yet. Use <strong>Assign Company Apps</strong> first.
          </div>
        ) : (
          apps.map((app) => {
            const isOpen = expanded.has(app.id)
            const keys = keysFor(app.id)
            const draft = drafts[app.id] || { key: '', value: '' }
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
                      {keys.length} setting{keys.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: '#1a56a0' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={{ padding: '12px 14px', borderTop: '1.5px solid #d0e0f4' }}>
                    {keys.length === 0 && (
                      <div style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
                        No settings yet. Add one below — e.g. <code style={{ color: '#1a56a0' }}>{(app.app_link || 'app').replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_')}_admin_group</code>.
                      </div>
                    )}

                    {keys.map((key) => (
                      <div key={key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span>{keyLabel(key)}</span>
                          <button
                            onClick={() => deleteKey(app.id, key)}
                            title="Remove setting"
                            style={{ background: 'none', border: 'none', color: '#b02020', cursor: 'pointer', fontSize: 13, padding: 0, textTransform: 'none', fontWeight: 600 }}
                          >
                            Remove
                          </button>
                        </label>
                        {KEY_IS_GROUP(key) ? (
                          <select
                            value={(values[app.id] || {})[key] || ''}
                            onChange={(e) => setValue(app.id, key, e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">— select a group —</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            {/* Preserve a stored value that no longer matches a known group. */}
                            {(values[app.id] || {})[key] && !groupName[(values[app.id] || {})[key]] && (
                              <option value={(values[app.id] || {})[key]}>(unknown group)</option>
                            )}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={(values[app.id] || {})[key] || ''}
                            onChange={(e) => setValue(app.id, key, e.target.value)}
                            style={inputStyle}
                          />
                        )}
                      </div>
                    ))}

                    {/* Add a new setting */}
                    <div style={{ marginTop: 4, padding: '12px', background: '#f5f8ff', borderRadius: 8, border: '1px dashed #d0e0f4' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a56a0', marginBottom: 8 }}>Add a setting</div>
                      <input
                        value={draft.key}
                        onChange={(e) => setDraft(app.id, { key: e.target.value })}
                        placeholder="config_key (e.g. tickets_admin_group)"
                        style={{ ...inputStyle, marginBottom: 8 }}
                      />
                      {KEY_IS_GROUP(draft.key.trim().toLowerCase().replace(/\s+/g, '_')) ? (
                        <select value={draft.value} onChange={(e) => setDraft(app.id, { value: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }}>
                          <option value="">— select a group —</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      ) : (
                        <input
                          value={draft.value}
                          onChange={(e) => setDraft(app.id, { value: e.target.value })}
                          placeholder="value"
                          style={{ ...inputStyle, marginBottom: 8 }}
                        />
                      )}
                      <button
                        onClick={() => addKey(app.id)}
                        disabled={!draft.key.trim()}
                        style={{
                          background: draft.key.trim() ? '#1a56a0' : '#c8d6e5', color: '#fff', border: 'none',
                          borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                          cursor: draft.key.trim() ? 'pointer' : 'default',
                        }}
                      >
                        + Add Setting
                      </button>
                    </div>

                    <button
                      onClick={() => saveApp(app.id)}
                      disabled={saving === app.id}
                      style={{
                        width: '100%', marginTop: 12, background: saving === app.id ? '#a0b8d0' : '#1a56a0',
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
