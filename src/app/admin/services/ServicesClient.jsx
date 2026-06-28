'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Short price label for a service row: "$150" flat or "$75/hr" hourly.
function priceLabel(s) {
  if (s.pricing_type === 'hourly') return `$${num(s.hourly_rate).toFixed(0)}/hr`
  return `$${num(s.flat_rate).toFixed(0)}`
}

export default function ServicesClient({ initialServices = [] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return initialServices
    return initialServices.filter((s) => {
      const hay = `${s.name || ''} ${s.description || ''} ${s.category || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [initialServices, search])

  // Group filtered services by category, preserving the server's ordering.
  // Services with no category land under "Uncategorized".
  const groups = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const key = s.category?.trim() || 'Uncategorized'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return Array.from(map.entries())
  }, [filtered])

  const hasCategories = useMemo(
    () => initialServices.some((s) => s.category?.trim()),
    [initialServices]
  )

  return (
    <div className="wrap">
      <PageHeader title="Manage Services" />

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          placeholder="Search services…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* List */}
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛠️</div>
            {search ? 'No services match your search' : 'No services yet'}
          </div>
        ) : (
          groups.map(([category, services]) => (
            <div key={category}>
              {hasCategories && <div className="group-head">{category}</div>}
              {services.map((s) => (
                <button
                  key={s.id}
                  className="row"
                  onClick={() => router.push(`/admin/services/${s.id}`)}
                >
                  <span className={`dot ${s.active ? 'on' : 'off'}`} />
                  <div className="row-main">
                    <div className="row-name">{s.name || 'Unnamed service'}</div>
                    {s.description && <div className="row-sub">{s.description}</div>}
                  </div>
                  <div className="row-price">
                    <span className={`badge ${s.pricing_type === 'hourly' ? 'badge--hr' : 'badge--flat'}`}>
                      {s.pricing_type === 'hourly' ? 'Hourly' : 'Flat Rate'}
                    </span>
                    <span className="price">{priceLabel(s)}</span>
                  </div>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Add button */}
      <div className="footer">
        <button className="add-btn" onClick={() => router.push('/admin/services/new')}>
          + Add Service
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
        .group-head {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: ${C_MUTED};
          background: #f5f8ff;
          padding: 6px 12px;
          border-bottom: 1.5px solid ${C_BORDER};
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
          flex-shrink: 0;
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }
        .dot.on {
          background: #2e9e4f;
        }
        .dot.off {
          background: #c8d3dd;
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .row-price {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
        }
        .badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 2px 7px;
          border-radius: 10px;
        }
        .badge--flat {
          background: #e6f0ff;
          color: ${C};
        }
        .badge--hr {
          background: #fff0e0;
          color: #b06a16;
        }
        .price {
          font-size: 14px;
          font-weight: 700;
          color: ${C};
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
