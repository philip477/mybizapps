'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Check', 'Bank Transfer', 'Other']

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

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C, marginBottom: 4 }

export default function ExpenseFormClient({ expense, isNew, categories = [] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    description: expense?.description || '',
    amount: expense?.amount ?? '',
    category_id: expense?.category_id || '',
    vendor: expense?.vendor || '',
    expense_date: expense?.expense_date ? expense.expense_date.split('T')[0] : '',
    payment_method: expense?.payment_method || '',
    notes: expense?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError('')
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }
    if (form.amount === '' || isNaN(Number(form.amount))) {
      setError('Enter a valid amount.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        description: form.description.trim(),
        amount: Number(form.amount),
        category_id: form.category_id || null,
        vendor: form.vendor.trim() || null,
        expense_date: form.expense_date || null,
        payment_method: form.payment_method || null,
        notes: form.notes.trim() || null,
      }
      if (isNew) {
        payload.facility_id = localStorage.getItem('biz_facility_id')
        const { error: err } = await supabase.from('biz_expenses').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_expenses')
          .update(payload)
          .eq('id', expense.id)
        if (err) throw err
      }
      router.push('/accounting')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this expense?')) return
    setDeleting(true)
    const { error: err } = await supabase.from('biz_expenses').delete().eq('id', expense.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/accounting')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader title={isNew ? 'Add Expense' : 'Edit Expense'} />

      <div className="body">
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label style={labelStyle}>Description *</label>
          <input
            style={inputStyle}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Amount *</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Category</label>
          <select
            style={inputStyle}
            value={form.category_id}
            onChange={(e) => set('category_id', e.target.value)}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label style={labelStyle}>Vendor</label>
          <input
            style={inputStyle}
            value={form.vendor}
            onChange={(e) => set('vendor', e.target.value)}
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Date</label>
          <input
            style={inputStyle}
            type="date"
            value={form.expense_date}
            onChange={(e) => set('expense_date', e.target.value)}
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Payment Method</label>
          <select
            style={inputStyle}
            value={form.payment_method}
            onChange={(e) => set('payment_method', e.target.value)}
          >
            <option value="">Select…</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </div>

      <div className="footer">
        {!isNew && (
          <button className="del-btn" onClick={handleDelete} disabled={deleting || saving}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <button className="save-btn" onClick={handleSave} disabled={saving || deleting}>
          {saving ? 'Saving…' : 'Save'}
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
          margin-bottom: 16px;
        }
        .footer {
          position: sticky;
          bottom: 0;
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #fff;
          border-top: 1.5px solid ${C_BORDER};
        }
        .save-btn {
          flex: 1;
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
        .save-btn:disabled {
          background: #a0b8d0;
          cursor: not-allowed;
        }
        .del-btn {
          background: none;
          color: #b02020;
          border: 1.5px solid #f5b3b3;
          border-radius: 6px;
          padding: 14px 20px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .del-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
