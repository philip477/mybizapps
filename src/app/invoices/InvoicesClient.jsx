'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

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
  const [converting, setConverting] = useState(null) // id of quote being converted
  const [error, setError] = useState('')

  const docs = useMemo(
    () => initialDocs.filter((d) => (d.doc_type || 'invoice') === tab),
    [initialDocs, tab]
  )

  // Convert an accepted quote into a fresh draft invoice: copy the quote's
  // customer, line items, totals, notes and terms; mark the quote "accepted";
  // then open the new invoice for review. Self-contained — the list rows carry
  // only summary fields, so the full quote + its items are fetched here.
  async function convertToInvoice(quote, e) {
    e.stopPropagation()
    if (converting) return
    setError('')
    setConverting(quote.id)
    try {
      const [{ data: full, error: qErr }, { data: qItems, error: iErr }] = await Promise.all([
        supabase.from('biz_invoices').select('*').eq('id', quote.id).single(),
        supabase
          .from('biz_invoice_items')
          .select('*')
          .eq('invoice_id', quote.id)
          .order('sort_order', { ascending: true }),
      ])
      if (qErr) throw qErr
      if (iErr) throw iErr

      // Next sequential invoice number, scoped to the facility via RLS.
      const { count } = await supabase
        .from('biz_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('doc_type', 'invoice')
      const invoiceNumber = `INV-${1001 + (count || 0)}`

      const { data: created, error: insErr } = await supabase
        .from('biz_invoices')
        .insert({
          doc_type: 'invoice',
          customer_id: full.customer_id,
          status: 'draft',
          subtotal: full.subtotal,
          tax_rate: full.tax_rate,
          tax_amount: full.tax_amount,
          total: full.total,
          notes: full.notes,
          terms: full.terms,
          facility_id: full.facility_id,
          invoice_number: invoiceNumber,
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      if (qItems && qItems.length) {
        const { error: itErr } = await supabase.from('biz_invoice_items').insert(
          qItems.map((it, i) => ({
            invoice_id: created.id,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            amount: it.amount,
            sort_order: it.sort_order ?? i,
          }))
        )
        if (itErr) throw itErr
      }

      const { error: updErr } = await supabase
        .from('biz_invoices')
        .update({ status: 'accepted' })
        .eq('id', quote.id)
      if (updErr) throw updErr

      router.push(`/invoices/${created.id}`)
      router.refresh()
    } catch (err) {
      setConverting(null)
      setError(err.message || 'Convert failed')
    }
  }

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

      {error && <div className="error">{error}</div>}

      {/* List */}
      <div className="list">
        {docs.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
            No {tab === 'invoice' ? 'invoices' : 'quotes'} yet
          </div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="row"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/invoices/${d.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') router.push(`/invoices/${d.id}`)
              }}
            >
              <div className="row-main">
                <div className="row-top">
                  <span className="row-num">{d.invoice_number || '(no number)'}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="row-sub">{customerName(d)}</div>
                {d.due_date && <div className="row-sub">Due {fmtDate(d.due_date)}</div>}
              </div>
              <div className="row-total">{money(d.total)}</div>
              {tab === 'quote' && (
                <button
                  className="convert-btn"
                  onClick={(e) => convertToInvoice(d, e)}
                  disabled={!!converting}
                  title="Create an invoice from this quote"
                >
                  {converting === d.id ? '…' : '→ Invoice'}
                </button>
              )}
            </div>
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
        .convert-btn {
          flex-shrink: 0;
          background: #f5f8ff;
          color: ${C};
          border: 1.5px solid ${C};
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .convert-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .error {
          margin: 10px 12px 0;
          background: #fde8e8;
          color: #b02020;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
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
