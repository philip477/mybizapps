'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

// Location line: "City, ST" with graceful handling of missing parts.
function locationLine(c) {
  const parts = [c.city, c.state].filter(Boolean)
  return parts.join(', ')
}

export default function CompaniesClient({ initialCompanies = [] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return initialCompanies
    return initialCompanies.filter((c) => {
      const hay = `${c.name || ''} ${c.city || ''} ${c.state || ''} ${c.phone || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [initialCompanies, search])

  return (
    <div className="wrap">
      <PageHeader title="Companies" />

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* List */}
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏢</div>
            {search ? 'No companies match your search' : 'No companies yet'}
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              className="row"
              onClick={() => router.push(`/master-control/facilities/${c.id}`)}
            >
              <span
                className="dot"
                style={{ background: c.active ? '#2e9e4f' : '#c23b3b' }}
                aria-label={c.active ? 'Active' : 'Inactive'}
              />
              <div className="row-main">
                <div className="row-name">{c.name || 'Unnamed company'}</div>
                {locationLine(c) && <div className="row-sub">{locationLine(c)}</div>}
                {c.phone && <div className="row-sub">{c.phone}</div>}
              </div>
              <span className="chev">›</span>
            </button>
          ))
        )}
      </div>

      {/* Add button */}
      <div className="footer">
        <button
          className="add-btn"
          onClick={() => router.push('/master-control/facilities/new')}
        >
          + Add Company
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
