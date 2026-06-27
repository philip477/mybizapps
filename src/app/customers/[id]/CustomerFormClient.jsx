'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

const FIELDS = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'notes', label: 'Notes', multiline: true },
]

function blankForm() {
  return FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
}

export default function CustomerFormClient({ customer, isNew }) {
  const router = useRouter()
  const [form, setForm] = useState(() => {
    if (!customer) return blankForm()
    return FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: customer[f.key] ?? '' }), {})
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError('')
    // Require at least one identifying field.
    if (!form.company_name.trim() && !form.first_name.trim() && !form.last_name.trim()) {
      setError('Enter a company name or a first/last name.')
      return
    }
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        FIELDS.map((f) => [f.key, form[f.key].trim() === '' ? null : form[f.key].trim()])
      )

      if (isNew) {
        const facilityId = localStorage.getItem('biz_facility_id')
        payload.facility_id = facilityId
        const { error: err } = await supabase.from('biz_customers').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_customers')
          .update(payload)
          .eq('id', customer.id)
        if (err) throw err
      }
      router.push('/customers')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    const { error: err } = await supabase.from('biz_customers').delete().eq('id', customer.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/customers')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader title={isNew ? 'New Customer' : 'Edit Customer'} />

      <div className="body">
        {error && <div className="error">{error}</div>}

        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label className="label">{f.label}</label>
            {f.multiline ? (
              <textarea
                className="input"
                rows={3}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                style={{ resize: 'vertical' }}
              />
            ) : (
              <input
                className="input"
                type={f.type || 'text'}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
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
        .label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 4px;
        }
        .input {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid ${C_BORDER};
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 15px;
          color: ${C};
          outline: none;
          font-family: inherit;
        }
        .input:focus {
          border-color: ${C};
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
