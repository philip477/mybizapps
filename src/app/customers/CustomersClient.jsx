'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

// Display name: prefer company, fall back to person name, then email.
function displayName(c) {
  if (c.company_name) return c.company_name
  const person = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  return person || c.email || 'Unnamed customer'
}

export default function CustomersClient({ initialCustomers = [] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return initialCustomers
    return initialCustomers.filter((c) => {
      const hay = `${c.company_name || ''} ${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [initialCustomers, search])

  return (
    <div className="wrap">
      <PageHeader title="Customers" />

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* List */}
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
            {search ? 'No customers match your search' : 'No customers yet'}
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              className="row"
              onClick={() => router.push(`/customers/${c.id}`)}
            >
              <div className="row-main">
                <div className="row-name">{displayName(c)}</div>
                {c.email && <div className="row-sub">{c.email}</div>}
                {c.phone && <div className="row-sub">{c.phone}</div>}
              </div>
              <span className="chev">›</span>
            </button>
          ))
        )}
      </div>

      {/* Add button */}
      <div className="footer">
        <button className="add-btn" onClick={() => router.push('/customers/new')}>
          + Add Customer
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
