'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

const STATUS_COLORS = {
  draft: { bg: '#eceff2', fg: '#5a6675' },
  sent: { bg: '#e3eefb', fg: '#1a56a0' },
  paid: { bg: '#e1f3e7', fg: '#1a7a42' },
  overdue: { bg: '#fde8e8', fg: '#b02020' },
}

function customerName(doc) {
  const c = doc.biz_customers
  if (!c) return 'No customer'
  if (c.company_name) return c.company_name
  const person = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  return person || 'No customer'
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`
}

function fmtDate(d) {
  if (!d) return ''
  // Parse as date-only to avoid TZ shifting.
  const [y, m, day] = d.split('T')[0].split('-')
  return `${m}/${day}/${y}`
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        background: s.bg,
        color: s.fg,
        padding: '2px 8px',
        borderRadius: 10,
        letterSpacing: 0.3,
      }}
    >
      {status || 'draft'}
    </span>
  )
}

export default function InvoicesClient({ initialDocs = [] }) {
  const router = useRouter()
  const [tab, setTab] = useState('invoice') // 'invoice' | 'quote'

  const docs = useMemo(
    () => initialDocs.filter((d) => (d.doc_type || 'invoice') === tab),
    [initialDocs, tab]
  )

  return (
    <div className="wrap">
      <PageHeader title="Invoices & Quotes" />

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'invoice', label: 'Invoices' },
          { key: 'quote', label: 'Quotes' },
        ].map((t) => (
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
        {docs.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
            No {tab === 'invoice' ? 'invoices' : 'quotes'} yet
          </div>
        ) : (
          docs.map((d) => (
            <button key={d.id} className="row" onClick={() => router.push(`/invoices/${d.id}`)}>
              <div className="row-main">
                <div className="row-top">
                  <span className="row-num">{d.invoice_number || '(no number)'}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="row-sub">{customerName(d)}</div>
                {d.due_date && <div className="row-sub">Due {fmtDate(d.due_date)}</div>}
              </div>
              <div className="row-total">{money(d.total)}</div>
            </button>
          ))
        )}
      </div>

      {/* Footer actions */}
      <div className="footer">
        <button className="act-btn" onClick={() => router.push('/invoices/new?type=invoice')}>
          + Create Invoice
        </button>
        <button
          className="act-btn act-btn--ghost"
          onClick={() => router.push('/invoices/new?type=quote')}
        >
          + Create Quote
        </button>
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
        }
        .tabs {
          display: flex;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .tab {
          flex: 1;
          padding: 12px 0;
          background: #fff;
          border: none;
          border-bottom: 2.5px solid transparent;
          font-size: 14px;
          font-weight: 600;
          color: ${C_MUTED};
          cursor: pointer;
          font-family: inherit;
        }
        .tab--active {
          color: ${C};
          border-bottom-color: ${C};
          background: #f5f8ff;
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
        .row-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 3px;
        }
        .row-num {
          font-size: 15px;
          font-weight: 700;
          color: ${C};
        }
        .row-sub {
          font-size: 13px;
          color: ${C_MUTED};
        }
        .row-total {
          font-size: 16px;
          font-weight: 700;
          color: ${C};
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
          display: flex;
          gap: 10px;
          padding: 12px;
          background: #fff;
          border-top: 1.5px solid ${C_BORDER};
        }
        .act-btn {
          flex: 1;
          background: ${C};
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 13px 0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .act-btn--ghost {
          background: #fff;
          color: ${C};
          border: 1.5px solid ${C};
        }
      `}</style>
    </div>
  )
}
