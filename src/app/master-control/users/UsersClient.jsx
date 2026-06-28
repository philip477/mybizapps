'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

// Role badge colors: user=gray, super_user=blue, master_control=purple.
const ROLE_META = {
  user: { label: 'User', bg: '#eef1f4', fg: '#5a6573' },
  super_user: { label: 'Super User', bg: '#e3edfb', fg: '#1a56a0' },
  master_control: { label: 'Master Control', bg: '#efe6fb', fg: '#6b3fb0' },
  demo: { label: 'Demo', bg: '#fff3e0', fg: '#a4691a' },
}

// Top filter tabs. "Super Users" pulls in master_control too, so this page
// shows every elevated account in one place.
const TABS = [
  { key: 'all', label: 'All Users' },
  { key: 'super_user', label: 'Super Users' },
  { key: 'master_control', label: 'Master Control' },
]

function fullName(u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return name || u.display_name || u.email || 'Unnamed user'
}

function companyName(u) {
  return u.facilities?.name || ''
}

function roleMeta(role) {
  return ROLE_META[role] || ROLE_META.user
}

export default function UsersClient({ initialUsers = [] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return initialUsers.filter((u) => {
      if (tab === 'super_user' && u.user_role !== 'super_user') return false
      if (tab === 'master_control' && u.user_role !== 'master_control') return false
      if (!q) return true
      const hay = `${fullName(u)} ${u.email || ''} ${companyName(u)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [initialUsers, search, tab])

  return (
    <div className="wrap">
      <PageHeader title="Manage Superusers" onBack={() => router.push('/master-control')} />

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          placeholder="Search name, email, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
            {search || tab !== 'all' ? 'No users match your filter' : 'No users yet'}
          </div>
        ) : (
          filtered.map((u) => {
            const meta = roleMeta(u.user_role)
            return (
              <button
                key={u.id}
                className="row"
                onClick={() => router.push(`/master-control/users/${u.id}`)}
              >
                <span
                  className="dot"
                  style={{ background: u.active ? '#2e9e4f' : '#c23b3b' }}
                  aria-label={u.active ? 'Active' : 'Inactive'}
                />
                <div className="row-main">
                  <div className="row-name">{fullName(u)}</div>
                  {u.email && <div className="row-sub">{u.email}</div>}
                  {companyName(u) && <div className="row-sub">{companyName(u)}</div>}
                </div>
                <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
                  {meta.label}
                </span>
                <span className="chev">›</span>
              </button>
            )
          })
        )}
      </div>

      {/* Add button */}
      <div className="footer">
        <button className="add-btn" onClick={() => router.push('/master-control/users/new')}>
          + Add User
        </button>
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
        }
        .search-row {
          padding: 12px;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .search-input {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid ${C};
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 15px;
          color: ${C};
          outline: none;
          font-family: inherit;
        }
        .tabs {
          display: flex;
          gap: 6px;
          padding: 10px 12px;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .tab {
          flex: 1;
          background: #fff;
          border: 1.5px solid ${C_BORDER};
          border-radius: 6px;
          padding: 8px 6px;
          font-size: 13px;
          font-weight: 600;
          color: ${C_MUTED};
          cursor: pointer;
          font-family: inherit;
        }
        .tab--active {
          background: ${C};
          border-color: ${C};
          color: #fff;
        }
        .list {
          flex: 1;
        }
        .row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 12px;
          background: #fff;
          border: none;
          border-bottom: 1.5px solid ${C_BORDER};
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .row:hover {
          background: #f5f8ff;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .row-main {
          flex: 1;
          min-width: 0;
        }
        .row-name {
          font-size: 15px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 2px;
        }
        .row-sub {
          font-size: 13px;
          color: ${C_MUTED};
        }
        .badge {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 10px;
          white-space: nowrap;
        }
        .chev {
          font-size: 22px;
          color: ${C_BORDER};
          flex-shrink: 0;
        }
        .empty {
          padding: 48px 12px;
          text-align: center;
          color: ${C_MUTED};
          font-size: 14px;
        }
        .footer {
          position: sticky;
          bottom: 0;
          padding: 12px;
          background: #fff;
          border-top: 1.5px solid ${C_BORDER};
        }
        .add-btn {
          width: 100%;
          background: ${C};
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 14px 0;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
      `}</style>
    </div>
  )
}
