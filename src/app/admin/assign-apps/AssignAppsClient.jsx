'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// Assign Company Apps — toggle which User Apps the facility has, and reorder
// the enabled ones. Enabled = a biz_app_permission_mains row with active=true.
// Disabling keeps the row (active=false) so its order survives a re-enable.

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 48, height: 26, borderRadius: 13,
        background: checked ? '#1a56a0' : '#ccc',
        position: 'relative', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        transition: 'background 0.2s', opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
      }} />
    </div>
  )
}

function AppIcon({ icon, emoji, name }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return <img src={icon} alt="" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 8 }} />
  }
  if (icon || emoji) return <span style={{ fontSize: 26, lineHeight: 1 }}>{icon || emoji}</span>
  return <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{name?.charAt(0).toUpperCase() || '?'}</span>
}

export default function AssignAppsClient({
  appName = 'Assign Company Apps',
  facilityId = null,
  initialApps = [],
  initialPerms = [],
}) {
  const router = useRouter()
  const [apps] = useState(initialApps)
  const [search, setSearch] = useState('')

  // Permission rows keyed by app_id: { id, app_order, active }.
  const [perms, setPerms] = useState(() => {
    const m = {}
    for (const p of initialPerms) m[p.app_id] = { id: p.id, app_order: p.app_order, active: p.active }
    return m
  })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // Enabled apps in display order, then the rest alphabetically.
  const enabled = useMemo(() => {
    return apps
      .filter((a) => perms[a.id]?.active)
      .sort((x, y) => (perms[x.id].app_order ?? 0) - (perms[y.id].app_order ?? 0))
  }, [apps, perms])

  const disabled = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps
      .filter((a) => !perms[a.id]?.active)
      .filter((a) => !q || a.app_name.toLowerCase().includes(q))
      .sort((x, y) => x.app_name.localeCompare(y.app_name))
  }, [apps, perms, search])

  async function toggleApp(app, on) {
    if (!facilityId || busy) return
    setBusy(true)
    const existing = perms[app.id]
    try {
      if (on) {
        const order = enabled.length > 0
          ? Math.max(...enabled.map((a) => perms[a.id].app_order ?? 0)) + 1
          : 0
        if (existing?.id) {
          const { error } = await supabase
            .from('biz_app_permission_mains')
            .update({ active: true, app_order: order })
            .eq('id', existing.id)
          if (error) throw error
          setPerms((prev) => ({ ...prev, [app.id]: { ...prev[app.id], active: true, app_order: order } }))
        } else {
          const { data, error } = await supabase
            .from('biz_app_permission_mains')
            .insert({ facility_id: facilityId, app_id: app.id, app_order: order, active: true })
            .select('id')
            .single()
          if (error) throw error
          setPerms((prev) => ({ ...prev, [app.id]: { id: data.id, active: true, app_order: order } }))
        }
      } else {
        if (existing?.id) {
          const { error } = await supabase
            .from('biz_app_permission_mains')
            .update({ active: false })
            .eq('id', existing.id)
          if (error) throw error
          setPerms((prev) => ({ ...prev, [app.id]: { ...prev[app.id], active: false } }))
        }
      }
    } catch (err) {
      showToast(err.message || 'Update failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Move an enabled app up/down, renumbering the enabled set 1..n and
  // persisting every changed row.
  async function move(index, direction) {
    if (busy) return
    const list = [...enabled]
    const swap = index + direction
    if (swap < 0 || swap >= list.length) return
    const [moved] = list.splice(index, 1)
    list.splice(swap, 0, moved)

    setBusy(true)
    // Optimistic renumber.
    const next = { ...perms }
    list.forEach((a, i) => { next[a.id] = { ...next[a.id], app_order: i } })
    setPerms(next)

    try {
      await Promise.all(
        list.map((a, i) =>
          supabase.from('biz_app_permission_mains').update({ app_order: i }).eq('id', next[a.id].id)
        )
      )
    } catch (err) {
      showToast(err.message || 'Reorder failed', 'error')
    } finally {
      setBusy(false)
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

  function Row({ app, children }) {
    const isImageUrl = app.app_icon && (app.app_icon.startsWith('http') || app.app_icon.startsWith('/'))
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1.5px solid #d0e0f4', background: '#fff' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 8, flexShrink: 0,
          background: isImageUrl ? 'transparent' : '#1a56a0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <AppIcon icon={app.app_icon} emoji={app.app_icon_emoji} name={app.app_name} />
        </div>
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: '#1a56a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {app.app_name}
        </span>
        {children}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#fff', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={appName} onBack={() => router.push('/business-admin-apps')} />

      {/* Enabled apps — ordered, with reorder controls */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a56a0', background: '#f5f8ff', padding: '8px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
        ENABLED · {enabled.length} app{enabled.length !== 1 ? 's' : ''} on your home launcher
      </div>
      {enabled.length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: '#5580a0', fontSize: 14 }}>
          No apps enabled yet — switch some on below.
        </div>
      ) : (
        enabled.map((app, index) => (
          <Row key={app.id} app={app}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
              <button
                onClick={() => move(index, -1)}
                disabled={index === 0 || busy}
                style={{ background: 'none', border: '1.5px solid #d0e0f4', borderRadius: 4, width: 28, height: 24, cursor: index === 0 ? 'default' : 'pointer', color: '#1a56a0', fontSize: 12, lineHeight: 1, opacity: index === 0 ? 0.3 : 1 }}
              >▲</button>
              <button
                onClick={() => move(index, 1)}
                disabled={index === enabled.length - 1 || busy}
                style={{ background: 'none', border: '1.5px solid #d0e0f4', borderRadius: 4, width: 28, height: 24, cursor: index === enabled.length - 1 ? 'default' : 'pointer', color: '#1a56a0', fontSize: 12, lineHeight: 1, opacity: index === enabled.length - 1 ? 0.3 : 1 }}
              >▼</button>
            </div>
            <ToggleSwitch checked onChange={() => toggleApp(app, false)} disabled={busy} />
          </Row>
        ))
      )}

      {/* Available apps — search + toggle on */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', background: '#f5f8ff', padding: '8px 16px', borderTop: '1.5px solid #d0e0f4', borderBottom: '1.5px solid #d0e0f4', marginTop: 8 }}>
        AVAILABLE
      </div>
      <div style={{ padding: '10px 16px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps…"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 12px',
            border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15,
            color: '#1A1A2E', outline: 'none', fontFamily: "'Segoe UI', Arial, sans-serif",
          }}
        />
      </div>
      {disabled.length === 0 ? (
        <div style={{ padding: '14px 16px', textAlign: 'center', color: '#999', fontSize: 14 }}>
          {apps.length === 0 ? 'No User Apps exist yet.' : 'All apps are enabled.'}
        </div>
      ) : (
        disabled.map((app) => (
          <Row key={app.id} app={app}>
            <ToggleSwitch checked={false} onChange={() => toggleApp(app, true)} disabled={busy} />
          </Row>
        ))
      )}

      {toastEl}
    </div>
  )
}
