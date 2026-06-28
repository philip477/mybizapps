'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

function customerLabel(c) {
  if (c.company_name) return c.company_name
  const person = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  return person || 'Unnamed'
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(n) {
  return `$${num(n).toFixed(2)}`
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Builds the address lines for a company/customer record (skips blanks).
function addressLines(rec) {
  if (!rec) return []
  const cityLine = [rec.city, rec.state].filter(Boolean).join(', ')
  const cityZip = [cityLine, rec.zip].filter(Boolean).join(' ')
  return [rec.address, cityZip].filter((l) => l && l.trim())
}

function blankItem() {
  return { description: '', quantity: '1', unit_price: '', amount: 0 }
}

// Turn a catalog service into a line item. Hourly services pre-fill the
// estimated hours as the quantity and the hourly rate as the unit price; flat
// services use a quantity of 1 at the flat rate.
function itemFromService(s) {
  if (s.pricing_type === 'hourly') {
    return {
      description: s.name || '',
      quantity: String(s.estimated_hours ?? 1),
      unit_price: String(s.hourly_rate ?? ''),
      amount: 0,
    }
  }
  return {
    description: s.name || '',
    quantity: '1',
    unit_price: String(s.flat_rate ?? ''),
    amount: 0,
  }
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1.5px solid ${C_BORDER}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 15,
  color: C,
  outline: 'none',
  fontFamily: 'inherit',
}

export default function InvoiceFormClient({ isNew, docType, invoice, items, customers = [], facility = null, services = [] }) {
  const router = useRouter()
  const label = docType === 'quote' ? 'Quote' : 'Invoice'

  const [customerId, setCustomerId] = useState(invoice?.customer_id || '')
  const [lineItems, setLineItems] = useState(() =>
    items && items.length
      ? items.map((it) => ({
          id: it.id,
          description: it.description || '',
          quantity: it.quantity ?? '1',
          unit_price: it.unit_price ?? '',
          amount: num(it.amount),
        }))
      : [blankItem()]
  )
  const [taxRate, setTaxRate] = useState(invoice?.tax_rate ?? '')
  const [dueDate, setDueDate] = useState(invoice?.due_date ? invoice.due_date.split('T')[0] : '')
  const [notes, setNotes] = useState(invoice?.notes || '')
  const [terms, setTerms] = useState(invoice?.terms || '')
  const [busy, setBusy] = useState('') // '', 'draft', 'send'
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)

  // Derived totals
  const computed = useMemo(() => {
    const rows = lineItems.map((it) => ({ ...it, amount: num(it.quantity) * num(it.unit_price) }))
    const subtotal = rows.reduce((s, it) => s + it.amount, 0)
    const taxAmount = subtotal * (num(taxRate) / 100)
    const total = subtotal + taxAmount
    return { rows, subtotal, taxAmount, total }
  }, [lineItems, taxRate])

  function updateItem(idx, key, value) {
    setLineItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
    )
  }

  function addItem() {
    setLineItems((prev) => [...prev, blankItem()])
  }

  // Add a line item from a catalog service. If the only existing row is still
  // blank, replace it so the picker doesn't leave an empty leading row.
  function addFromService(s) {
    const item = itemFromService(s)
    setLineItems((prev) => {
      const onlyBlank =
        prev.length === 1 &&
        !prev[0].description.trim() &&
        !num(prev[0].unit_price) &&
        num(prev[0].quantity) <= 1
      return onlyBlank ? [item] : [...prev, item]
    })
    setShowCatalog(false)
  }

  function removeItem(idx) {
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  // Generate a sequential document number scoped to the facility (via RLS).
  async function nextDocNumber(type = docType) {
    const prefix = type === 'quote' ? 'QT' : 'INV'
    // Derive from the highest existing number (RLS scopes to the facility), not
    // count(*) — count reuses a number after a delete and collides under the new
    // (facility_id, invoice_number) unique index.
    const { data } = await supabase
      .from('biz_invoices')
      .select('invoice_number')
      .eq('doc_type', type)
      .like('invoice_number', `${prefix}-%`)
    let maxSeq = 1000
    for (const r of data || []) {
      const n = parseInt(String(r.invoice_number).split('-').pop(), 10)
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n
    }
    return `${prefix}-${maxSeq + 1}`
  }

  // Persists the invoice + line items. Returns the invoice id, or null on error
  // (sets the error state).
  async function persist(statusValue) {
    if (!customerId) {
      setError('Please choose a customer.')
      return null
    }

    const { subtotal, taxAmount, total } = computed
    const base = {
      doc_type: docType,
      customer_id: customerId,
      status: statusValue,
      subtotal,
      tax_rate: taxRate === '' ? null : num(taxRate),
      tax_amount: taxAmount,
      total,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
    }

    let invoiceId = invoice?.id

    if (isNew) {
      // facility_id is set server-side by a BEFORE INSERT trigger.
      base.invoice_number = await nextDocNumber()
      const { data, error: err } = await supabase
        .from('biz_invoices')
        .insert(base)
        .select('id')
        .single()
      if (err) throw err
      invoiceId = data.id
    } else {
      const { error: err } = await supabase.from('biz_invoices').update(base).eq('id', invoiceId)
      if (err) throw err
    }

    // Build the non-empty line-item rows.
    const rowsToInsert = lineItems
      .filter((it) => it.description.trim() || num(it.unit_price) || num(it.quantity) > 1)
      .map((it, i) => ({
        invoice_id: invoiceId,
        description: it.description.trim(),
        quantity: num(it.quantity),
        unit_price: num(it.unit_price),
        amount: num(it.quantity) * num(it.unit_price),
        sort_order: i,
      }))

    if (isNew) {
      if (rowsToInsert.length) {
        const { error: itErr } = await supabase.from('biz_invoice_items').insert(rowsToInsert)
        if (itErr) throw itErr
      }
    } else {
      // Replace items via separate (non-transactional) calls: capture the current
      // rows first so a failed insert can be rolled back instead of losing them.
      const { data: oldItems } = await supabase
        .from('biz_invoice_items')
        .select('description, quantity, unit_price, amount, sort_order')
        .eq('invoice_id', invoiceId)
      await supabase.from('biz_invoice_items').delete().eq('invoice_id', invoiceId)
      if (rowsToInsert.length) {
        const { error: itErr } = await supabase.from('biz_invoice_items').insert(rowsToInsert)
        if (itErr) {
          if (oldItems?.length) {
            await supabase
              .from('biz_invoice_items')
              .insert(oldItems.map((it) => ({ ...it, invoice_id: invoiceId })))
          }
          throw itErr
        }
      }
    }

    return invoiceId
  }

  async function handleSaveDraft() {
    setError('')
    setBusy('draft')
    try {
      const id = await persist(invoice?.status || 'draft')
      if (!id) {
        setBusy('')
        return
      }
      router.push('/invoices')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setBusy('')
    }
  }

  async function handleSend() {
    setError('')
    setBusy('send')
    try {
      // Persist first so the API route reads the latest data.
      const id = await persist(invoice?.status === 'paid' ? 'paid' : 'sent')
      if (!id) {
        setBusy('')
        return
      }
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to send')
      }
      router.push('/invoices')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Send failed')
      setBusy('')
    }
  }

  // Generate an invoice from this (accepted) quote: copy customer, line items,
  // totals, notes and terms into a fresh draft invoice, mark the quote accepted,
  // then open the new invoice for review.
  async function handleConvert() {
    if (!customerId) {
      setError('Please choose a customer.')
      return
    }
    setError('')
    setBusy('convert')
    try {
      // Save any edits to the quote and flip it to "accepted".
      const quoteId = await persist('accepted')
      if (!quoteId) {
        setBusy('')
        return
      }

      const { subtotal, taxAmount, total } = computed
      const { data: created, error: insErr } = await supabase
        .from('biz_invoices')
        .insert({
          doc_type: 'invoice',
          customer_id: customerId,
          status: 'draft',
          subtotal,
          tax_rate: taxRate === '' ? null : num(taxRate),
          tax_amount: taxAmount,
          total,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          invoice_number: await nextDocNumber('invoice'),
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      const rowsToInsert = lineItems
        .filter((it) => it.description.trim() || num(it.unit_price) || num(it.quantity) > 1)
        .map((it, i) => ({
          invoice_id: created.id,
          description: it.description.trim(),
          quantity: num(it.quantity),
          unit_price: num(it.unit_price),
          amount: num(it.quantity) * num(it.unit_price),
          sort_order: i,
        }))
      if (rowsToInsert.length) {
        const { error: itErr } = await supabase.from('biz_invoice_items').insert(rowsToInsert)
        if (itErr) throw itErr
      }

      router.push(`/invoices/${created.id}`)
      router.refresh()
    } catch (err) {
      setError(err.message || 'Convert failed')
      setBusy('')
    }
  }

  return (
    <div className="wrap">
      <PageHeader
        title={`${isNew ? 'New' : 'Edit'} ${label}${invoice?.invoice_number ? ` · ${invoice.invoice_number}` : ''}`}
      />

      <div className="body">
        {error && <div className="error">{error}</div>}

        {/* Customer */}
        <div className="field">
          <label className="label">Customer *</label>
          <select
            style={inputStyle}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </select>
        </div>

        {/* Line items */}
        <div className="field">
          <label className="label">Line Items</label>
          {computed.rows.map((it, idx) => (
            <div className="item" key={idx}>
              <input
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
              />
              <div className="item-row">
                <div className="item-cell">
                  <span className="mini">Qty</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="any"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                </div>
                <div className="item-cell">
                  <span className="mini">Unit Price</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="any"
                    value={it.unit_price}
                    onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                  />
                </div>
                <div className="item-cell item-amount">
                  <span className="mini">Amount</span>
                  <div className="amount-val">{money(it.amount)}</div>
                </div>
                <button
                  className="rm-btn"
                  onClick={() => removeItem(idx)}
                  disabled={lineItems.length === 1}
                  aria-label="Remove line item"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div className="line-actions">
            <button className="add-line" onClick={addItem}>
              + Add Line Item
            </button>
            {services.length > 0 && (
              <button className="add-line add-line--alt" onClick={() => setShowCatalog(true)}>
                + Add from catalog
              </button>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="totals">
          <div className="trow">
            <span>Subtotal</span>
            <span>{money(computed.subtotal)}</span>
          </div>
          <div className="trow">
            <span>Tax Rate (%)</span>
            <input
              style={{ ...inputStyle, width: 90, textAlign: 'right', padding: '6px 10px' }}
              type="number"
              min="0"
              step="any"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div className="trow">
            <span>Tax Amount</span>
            <span>{money(computed.taxAmount)}</span>
          </div>
          <div className="trow trow--total">
            <span>Total</span>
            <span>{money(computed.total)}</span>
          </div>
        </div>

        {/* Due date / notes / terms */}
        <div className="field">
          <label className="label">Due Date</label>
          <input
            style={inputStyle}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Notes</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Terms</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="footer">
        {docType === 'quote' && !isNew && (
          <button className="act-btn" onClick={handleConvert} disabled={!!busy}>
            {busy === 'convert' ? 'Converting…' : '→ Invoice'}
          </button>
        )}
        <button
          className="act-btn act-btn--ghost"
          onClick={() => setShowPreview(true)}
          disabled={!!busy}
        >
          Preview
        </button>
        <button
          className="act-btn act-btn--ghost"
          onClick={handleSaveDraft}
          disabled={!!busy}
        >
          {busy === 'draft' ? 'Saving…' : 'Save as Draft'}
        </button>
        <button className="act-btn" onClick={handleSend} disabled={!!busy}>
          {busy === 'send' ? 'Sending…' : 'Send via Email'}
        </button>
      </div>

      {showCatalog && (
        <CatalogPicker
          services={services}
          onPick={addFromService}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {showPreview && (
        <InvoicePreview
          docType={docType}
          facility={facility}
          customer={customers.find((c) => c.id === customerId) || null}
          invoiceNumber={invoice?.invoice_number}
          issueDate={invoice?.created_at}
          dueDate={dueDate}
          rows={computed.rows}
          subtotal={computed.subtotal}
          taxRate={taxRate}
          taxAmount={computed.taxAmount}
          total={computed.total}
          notes={notes}
          terms={terms}
          onClose={() => setShowPreview(false)}
        />
      )}

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
        }
        .body {
          flex: 1;
          padding: 16px 12px 24px;
        }
        .error {
          background: #fde8e8;
          color: #b02020;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .field {
          margin-bottom: 18px;
        }
        .label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 6px;
        }
        .item {
          border: 1.5px solid ${C_BORDER};
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 10px;
          background: #fafcff;
        }
        .item-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }
        .item-cell {
          flex: 1;
          min-width: 0;
        }
        .item-amount {
          flex: 1.1;
        }
        .mini {
          display: block;
          font-size: 11px;
          color: ${C_MUTED};
          margin-bottom: 2px;
        }
        .amount-val {
          padding: 10px 0;
          font-size: 15px;
          font-weight: 700;
          color: ${C};
          text-align: right;
        }
        .rm-btn {
          flex-shrink: 0;
          width: 38px;
          height: 40px;
          background: #fff;
          border: 1.5px solid #f5b3b3;
          color: #b02020;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }
        .rm-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .line-actions {
          display: flex;
          gap: 8px;
        }
        .add-line {
          flex: 1;
          width: 100%;
          background: #f5f8ff;
          color: ${C};
          border: 1.5px dashed ${C};
          border-radius: 6px;
          padding: 10px 0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .add-line--alt {
          background: #fff;
        }
        .totals {
          border: 1.5px solid ${C_BORDER};
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 18px;
        }
        .trow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
          color: ${C_MUTED};
          padding: 5px 0;
        }
        .trow--total {
          border-top: 1.5px solid ${C_BORDER};
          margin-top: 6px;
          padding-top: 10px;
          font-size: 17px;
          font-weight: 700;
          color: ${C};
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
        .act-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

// Full-screen, full-width printable preview of the invoice/quote. Rendered as an
// overlay above the 480px app column. The print stylesheet hides everything but
// the sheet so window.print() / "Save as PDF" produces a clean document.
function InvoicePreview({
  docType,
  facility,
  customer,
  invoiceNumber,
  issueDate,
  dueDate,
  rows,
  subtotal,
  taxRate,
  taxAmount,
  total,
  notes,
  terms,
  onClose,
}) {
  const title = docType === 'quote' ? 'QUOTE' : 'INVOICE'
  const companyName = facility?.name || 'Your Company'
  const companyLines = addressLines(facility)
  const billToName = customer ? customerLabel(customer) : 'No customer selected'
  const billToLines = addressLines(customer)
  // Only show line items that have something meaningful in them.
  const visibleRows = (rows || []).filter(
    (it) => it.description.trim() || num(it.unit_price) || num(it.quantity) > 1
  )

  return (
    <div className="pv-overlay" role="dialog" aria-modal="true">
      <div className="pv-toolbar">
        <button className="pv-close" onClick={onClose}>
          ← Back to editing
        </button>
        <button className="pv-print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div className="pv-scroll">
        <div className="sheet" id="invoice-print-sheet">
          {/* Header: company + document meta */}
          <div className="sheet-head">
            <div className="company">
              {facility?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="logo" src={facility.logo_url} alt={companyName} />
              ) : (
                <div className="company-name">{companyName}</div>
              )}
              {facility?.logo_url && <div className="company-name sub">{companyName}</div>}
              {companyLines.map((l, i) => (
                <div className="muted-line" key={i}>
                  {l}
                </div>
              ))}
              {facility?.phone && <div className="muted-line">{facility.phone}</div>}
            </div>
            <div className="doc-meta">
              <div className="doc-title">{title}</div>
              <table className="meta-table">
                <tbody>
                  <tr>
                    <td className="meta-k">Number</td>
                    <td className="meta-v">{invoiceNumber || 'Draft'}</td>
                  </tr>
                  <tr>
                    <td className="meta-k">Date</td>
                    <td className="meta-v">{formatDate(issueDate)}</td>
                  </tr>
                  {dueDate && (
                    <tr>
                      <td className="meta-k">Due</td>
                      <td className="meta-v">{formatDate(dueDate)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill To */}
          <div className="bill-to">
            <div className="section-label">Bill To</div>
            <div className="bill-name">{billToName}</div>
            {billToLines.map((l, i) => (
              <div className="muted-line" key={i}>
                {l}
              </div>
            ))}
            {customer?.email && <div className="muted-line">{customer.email}</div>}
            {customer?.phone && <div className="muted-line">{customer.phone}</div>}
          </div>

          {/* Line items */}
          <table className="items">
            <thead>
              <tr>
                <th className="col-desc">Description</th>
                <th className="col-num">Qty</th>
                <th className="col-num">Unit Price</th>
                <th className="col-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={4}>
                    No line items yet.
                  </td>
                </tr>
              ) : (
                visibleRows.map((it, i) => (
                  <tr key={i}>
                    <td className="col-desc">{it.description || '—'}</td>
                    <td className="col-num">{num(it.quantity)}</td>
                    <td className="col-num">{money(it.unit_price)}</td>
                    <td className="col-num">{money(it.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="totals-wrap">
            <table className="sum-table">
              <tbody>
                <tr>
                  <td className="sum-k">Subtotal</td>
                  <td className="sum-v">{money(subtotal)}</td>
                </tr>
                <tr>
                  <td className="sum-k">Tax ({num(taxRate)}%)</td>
                  <td className="sum-v">{money(taxAmount)}</td>
                </tr>
                <tr className="sum-total">
                  <td className="sum-k">Total</td>
                  <td className="sum-v">{money(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes & terms */}
          {(notes.trim() || terms.trim()) && (
            <div className="footnotes">
              {notes.trim() && (
                <div className="fn-block">
                  <div className="section-label">Notes</div>
                  <div className="fn-text">{notes}</div>
                </div>
              )}
              {terms.trim() && (
                <div className="fn-block">
                  <div className="section-label">Terms</div>
                  <div className="fn-text">{terms}</div>
                </div>
              )}
            </div>
          )}

          <div className="thanks">Thank you for your business.</div>
        </div>
      </div>

      <style jsx>{`
        .pv-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: #525659;
          display: flex;
          flex-direction: column;
        }
        .pv-toolbar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          background: #2f3133;
        }
        .pv-close,
        .pv-print {
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .pv-close {
          background: transparent;
          color: #fff;
          border: 1.5px solid #6b6e70;
        }
        .pv-print {
          background: ${C};
          color: #fff;
        }
        .pv-scroll {
          flex: 1;
          overflow: auto;
          padding: 24px 16px 48px;
          display: flex;
          justify-content: center;
        }
        .sheet {
          width: 100%;
          max-width: 800px;
          background: #fff;
          color: #1f2933;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
          padding: 48px 52px;
          box-sizing: border-box;
          font-size: 14px;
          line-height: 1.5;
          align-self: flex-start;
        }
        .sheet-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 36px;
        }
        .logo {
          max-height: 64px;
          max-width: 220px;
          object-fit: contain;
          margin-bottom: 8px;
        }
        .company-name {
          font-size: 22px;
          font-weight: 700;
          color: ${C};
        }
        .company-name.sub {
          font-size: 15px;
          margin-bottom: 2px;
        }
        .muted-line {
          color: #5a6b7b;
          font-size: 13px;
        }
        .doc-meta {
          text-align: right;
          flex-shrink: 0;
        }
        .doc-title {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: 3px;
          color: ${C};
          margin-bottom: 12px;
        }
        .meta-table {
          margin-left: auto;
          border-collapse: collapse;
        }
        .meta-k {
          color: #5a6b7b;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: right;
          padding: 2px 10px 2px 0;
        }
        .meta-v {
          font-weight: 600;
          text-align: right;
          padding: 2px 0;
        }
        .bill-to {
          margin-bottom: 28px;
        }
        .section-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: ${C};
          margin-bottom: 6px;
        }
        .bill-name {
          font-size: 15px;
          font-weight: 700;
        }
        .items {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        .items thead th {
          background: ${C};
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          text-align: left;
        }
        .items thead th.col-num {
          text-align: right;
        }
        .items tbody td {
          padding: 11px 12px;
          border-bottom: 1px solid #e3eaf2;
          vertical-align: top;
        }
        .col-num {
          text-align: right;
          white-space: nowrap;
        }
        .col-desc {
          width: 60%;
        }
        .empty {
          text-align: center;
          color: #8696a6;
          padding: 24px 12px;
        }
        .totals-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }
        .sum-table {
          border-collapse: collapse;
          min-width: 260px;
        }
        .sum-k {
          color: #5a6b7b;
          padding: 6px 24px 6px 0;
        }
        .sum-v {
          text-align: right;
          font-weight: 600;
          padding: 6px 0;
        }
        .sum-total .sum-k,
        .sum-total .sum-v {
          border-top: 2px solid ${C};
          font-size: 18px;
          font-weight: 800;
          color: ${C};
          padding-top: 10px;
        }
        .footnotes {
          margin-top: 36px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .fn-text {
          color: #3d4d5c;
          white-space: pre-wrap;
        }
        .thanks {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #e3eaf2;
          text-align: center;
          color: #8696a6;
          font-size: 13px;
        }
      `}</style>

      {/* Print rules: isolate the sheet so only the document prints. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #invoice-print-sheet,
          #invoice-print-sheet * {
            visibility: visible !important;
          }
          #invoice-print-sheet {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          @page {
            margin: 16mm;
          }
        }
      `}</style>
    </div>
  )
}

// Modal picker for the service catalog. Searchable, grouped by category, and
// shows each service's pricing so the user knows what gets pre-filled.
function CatalogPicker({ services = [], onPick, onClose }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) =>
      `${s.name || ''} ${s.description || ''} ${s.category || ''}`.toLowerCase().includes(q)
    )
  }, [services, search])

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const key = s.category?.trim() || 'Uncategorized'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return Array.from(map.entries())
  }, [filtered])

  const hasCategories = services.some((s) => s.category?.trim())

  function priceLabel(s) {
    if (s.pricing_type === 'hourly') {
      const hrs = num(s.estimated_hours)
      const base = `$${num(s.hourly_rate).toFixed(0)}/hr`
      return hrs > 0 ? `${base} · ~${hrs}h` : base
    }
    return `$${num(s.flat_rate).toFixed(0)}`
  }

  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cp-head">
          <span className="cp-title">Add from catalog</span>
          <button className="cp-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="cp-search-row">
          <input
            className="cp-search"
            type="text"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="cp-list">
          {filtered.length === 0 ? (
            <div className="cp-empty">No services match your search.</div>
          ) : (
            groups.map(([category, list]) => (
              <div key={category}>
                {hasCategories && <div className="cp-group">{category}</div>}
                {list.map((s) => (
                  <button key={s.id} className="cp-row" onClick={() => onPick(s)}>
                    <div className="cp-row-main">
                      <div className="cp-name">{s.name || 'Unnamed service'}</div>
                      {s.description && <div className="cp-desc">{s.description}</div>}
                    </div>
                    <div className="cp-price">
                      <span className={`cp-badge ${s.pricing_type === 'hourly' ? 'cp-badge--hr' : ''}`}>
                        {s.pricing_type === 'hourly' ? 'Hourly' : 'Flat'}
                      </span>
                      <span className="cp-amt">{priceLabel(s)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .cp-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(20, 40, 70, 0.45);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .cp-panel {
          width: 100%;
          max-width: 480px;
          max-height: 82vh;
          background: #fff;
          border-radius: 14px 14px 0 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .cp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 14px 12px;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .cp-title {
          font-size: 16px;
          font-weight: 700;
          color: ${C};
        }
        .cp-close {
          background: none;
          border: none;
          font-size: 16px;
          color: ${C_MUTED};
          cursor: pointer;
          padding: 4px 8px;
        }
        .cp-search-row {
          padding: 12px;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .cp-search {
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
        .cp-list {
          flex: 1;
          overflow-y: auto;
        }
        .cp-group {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: ${C_MUTED};
          background: #f5f8ff;
          padding: 6px 12px;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .cp-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #fff;
          border: none;
          border-bottom: 1.5px solid ${C_BORDER};
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .cp-row:hover {
          background: #f5f8ff;
        }
        .cp-row-main {
          flex: 1;
          min-width: 0;
        }
        .cp-name {
          font-size: 15px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 2px;
        }
        .cp-desc {
          font-size: 13px;
          color: ${C_MUTED};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cp-price {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
        }
        .cp-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 2px 7px;
          border-radius: 10px;
          background: #e6f0ff;
          color: ${C};
        }
        .cp-badge--hr {
          background: #fff0e0;
          color: #b06a16;
        }
        .cp-amt {
          font-size: 14px;
          font-weight: 700;
          color: ${C};
        }
        .cp-empty {
          padding: 40px 12px;
          text-align: center;
          color: ${C_MUTED};
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
