'use client'

import { useState, useMemo } from 'react'
import PageHeader from '@/components/ui/PageHeader'

const NAV = '#1a56a0'
const MUTED = '#5580a0'
const BORDER = '#d0e0f4'

function empName(e) {
  return (e.display_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || '—')
}

function getInitials(name) {
  const parts = (name || '').split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

function PhoneIcon({ size = 14, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill={color} />
    </svg>
  )
}

function TabBar({ active, onTab }) {
  const tabs = [
    { key: 'extensions', label: 'Extensions' },
    { key: 'cellphones', label: 'Cell Phones' },
  ]
  return (
    <div style={{ display: 'flex', borderBottom: `2px solid ${NAV}`, background: '#fff' }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onTab(t.key)}
          style={{
            flex: 1,
            padding: '10px 4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'inherit',
            background: active === t.key ? NAV : 'transparent',
            color: active === t.key ? '#fff' : MUTED,
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Row({ emp, number }) {
  const name = empName(emp)
  const sub = [emp.job_title, emp.department].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1.5px solid ${BORDER}`, background: '#fff' }}>
      {emp.profile_photo_url ? (
        <img
          src={emp.profile_photo_url}
          alt={name}
          style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', border: `1.5px solid ${BORDER}` }}
        />
      ) : (
        <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: NAV, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{getInitials(name)}</span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: NAV, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
        {sub && <div style={{ fontSize: 13, color: MUTED, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      <a
        href={`tel:${number}`}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, background: NAV, color: '#fff', textDecoration: 'none', flexShrink: 0 }}
      >
        <PhoneIcon size={14} color="#fff" />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{number}</span>
      </a>
    </div>
  )
}

function ContactList({ employees, field, unit, emptyText }) {
  const [search, setSearch] = useState('')
  const [activeDept, setActiveDept] = useState(null)

  const list = useMemo(
    () => employees.filter((e) => (e[field] || '').trim()),
    [employees, field],
  )

  const departments = useMemo(() => {
    const set = new Set(list.map((e) => e.department).filter(Boolean))
    return Array.from(set).sort()
  }, [list])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((e) => {
      const matchDept = !activeDept || e.department === activeDept
      if (!matchDept) return false
      if (!q) return true
      return (
        empName(e).toLowerCase().includes(q) ||
        (e[field] || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.job_title || '').toLowerCase().includes(q)
      )
    })
  }, [list, search, activeDept, field])

  const pill = (label, isActive, onClick) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
        cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        border: `1.5px solid ${isActive ? NAV : BORDER}`,
        background: isActive ? NAV : '#fff',
        color: isActive ? '#fff' : MUTED,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: `1.5px solid ${BORDER}` }}>
        <input
          type="text"
          placeholder="Search by name, number, or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: `1.5px solid ${NAV}`, borderRadius: 4, fontSize: 14, color: NAV, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Department filter pills */}
      {departments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 16px', borderBottom: `1.5px solid ${BORDER}`, scrollbarWidth: 'none' }}>
          {pill('All', !activeDept, () => setActiveDept(null))}
          {departments.map((dept) =>
            pill(dept, activeDept === dept, () => setActiveDept(activeDept === dept ? null : dept)),
          )}
        </div>
      )}

      {/* Count bar */}
      <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: `1.5px solid ${BORDER}` }}>
        {filtered.length} {unit}{filtered.length !== 1 ? 's' : ''}{activeDept ? ` in ${activeDept}` : ''}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 14, color: MUTED }}>{emptyText}</div>
        ) : (
          filtered.map((e) => <Row key={e.id} emp={e} number={e[field]} />)
        )}
      </div>
    </div>
  )
}

export default function DirectoryClient({ appIcon = '', appName = 'Employee Directory', employees = [], showExtensions = false }) {
  const [tab, setTab] = useState(showExtensions ? 'extensions' : 'cellphones')

  const onExtensions = showExtensions && tab === 'extensions'

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Segoe UI', Arial, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={appName} appIcon={appIcon} />

      {showExtensions && <TabBar active={tab} onTab={setTab} />}

      {onExtensions ? (
        <ContactList employees={employees} field="phone" unit="extension" emptyText="No extensions found." />
      ) : (
        <ContactList employees={employees} field="cell_phone" unit="employee" emptyText="No cell phone numbers found." />
      )}
    </div>
  )
}
