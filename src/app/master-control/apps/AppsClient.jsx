'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

// Badge palette keyed by app_type.
const TYPE_BADGE = {
  'User App': { bg: '#e8f0fc', fg: '#1a56a0' },
  'Admin Only': { bg: '#fdeede', fg: '#b86a12' },
  'Master Control': { bg: '#efe6fb', fg: '#6b3fb0' },
}

function badgeStyle(type) {
  return TYPE_BADGE[type] || { bg: '#eef0f3', fg: '#5e6b7a' }
}

export default function AppsClient({ initialApps = [] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return initialApps
    return initialApps.filter((a) => {
      const hay = `${a.app_name || ''} ${a.app_type || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [initialApps, search])

  return (
    <div className="wrap">
      <PageHeader title="Edit Apps" />

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          placeholder="Search apps…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* List */}
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
            {search ? 'No apps match your search' : 'No apps yet'}
          </div>
        ) : (
          filtered.map((a) => {
            const badge = badgeStyle(a.app_type)
            return (
              <button
                key={a.id}
                className="row"
                onClick={() => router.push(`/master-control/apps/${a.id}`)}
              >
                <span className="icon">{a.app_icon_emoji || '📦'}</span>
                <div className="row-main">
                  <div className="row-name">{a.app_name || 'Unnamed app'}</div>
                  <div className="row-meta">
                    {a.app_type && (
                      <span
                        className="badge"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {a.app_type}
                      </span>
                    )}
                    <span
                      className="dot"
                      style={{ background: a.active ? '#2e9e4f' : '#c23b3b' }}
                      aria-label={a.active ? 'Active' : 'Inactive'}
                    />
                  </div>
                </div>
                <span className="chev">›</span>
              </button>
            )
          })
        )}
      </div>

      {/* Add button */}
      <div className="footer">
        <button
          className="add-btn"
          onClick={() => router.push('/master-control/apps/new')}
        >
          + Add App
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
        .icon {
          font-size: 24px;
          line-height: 1;
          flex-shrink: 0;
          width: 28px;
          text-align: center;
        }
        .row-main {
          flex: 1;
          min-width: 0;
        }
        .row-name {
          font-size: 15px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 4px;
        }
        .row-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
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
