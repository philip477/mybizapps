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

function blankItem() {
  return { description: '', quantity: '1', unit_price: '', amount: 0 }
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

export default function InvoiceFormClient({ isNew, docType, invoice, items, customers = [] }) {
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

  function removeItem(idx) {
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  // Generate a sequential document number scoped to the facility (via RLS).
  async function nextDocNumber() {
    const prefix = docType === 'quote' ? 'QT' : 'INV'
    const { count } = await supabase
      .from('biz_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('doc_type', docType)
    const seq = 1001 + (count || 0)
    return `${prefix}-${seq}`
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
      base.facility_id = localStorage.getItem('biz_facility_id')
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
      // Replace line items wholesale — simplest reliable sync.
      await supabase.from('biz_invoice_items').delete().eq('invoice_id', invoiceId)
    }

    // Insert non-empty line items.
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
    if (rowsToInsert.length) {
      const { error: itErr } = await supabase.from('biz_invoice_items').insert(rowsToInsert)
      if (itErr) throw itErr
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
          <button className="add-line" onClick={addItem}>
            + Add Line Item
          </button>
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
        .add-line {
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
