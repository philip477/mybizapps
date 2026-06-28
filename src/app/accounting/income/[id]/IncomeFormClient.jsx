'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

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

export default function IncomeFormClient({ income, isNew }) {
  const router = useRouter()
  const [form, setForm] = useState({
    description: income?.description || '',
    amount: income?.amount ?? '',
    source: income?.source || '',
    income_date: income?.income_date ? income.income_date.split('T')[0] : '',
    notes: income?.notes || '',
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
        source: form.source.trim() || null,
        income_date: form.income_date || null,
        notes: form.notes.trim() || null,
      }
      if (isNew) {
        // facility_id is set server-side by a BEFORE INSERT trigger.
        const { error: err } = await supabase.from('biz_income').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('biz_income').update(payload).eq('id', income.id)
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
    if (!confirm('Delete this income entry?')) return
    setDeleting(true)
    const { error: err } = await supabase.from('biz_income').delete().eq('id', income.id)
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
      <PageHeader title={isNew ? 'Add Income' : 'Edit Income'} />

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
          <label style={labelStyle}>Source</label>
          <input
            style={inputStyle}
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
            placeholder="e.g. Sales, Service, Interest"
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Date</label>
          <input
            style={inputStyle}
            type="date"
            value={form.income_date}
            onChange={(e) => set('income_date', e.target.value)}
          />
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
