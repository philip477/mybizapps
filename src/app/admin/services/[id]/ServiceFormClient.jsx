'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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

export default function ServiceFormClient({ service, isNew }) {
  const router = useRouter()

  const [name, setName] = useState(service?.name || '')
  const [description, setDescription] = useState(service?.description || '')
  const [category, setCategory] = useState(service?.category || '')
  const [pricingType, setPricingType] = useState(service?.pricing_type === 'hourly' ? 'hourly' : 'flat')
  const [flatRate, setFlatRate] = useState(service?.flat_rate ?? '')
  const [hourlyRate, setHourlyRate] = useState(service?.hourly_rate ?? '')
  const [estimatedHours, setEstimatedHours] = useState(service?.estimated_hours ?? '')
  const [sortOrder, setSortOrder] = useState(service?.sort_order ?? 0)
  const [active, setActive] = useState(service?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Estimated total for hourly services: rate × hours.
  const estTotal = useMemo(
    () => num(hourlyRate) * num(estimatedHours),
    [hourlyRate, estimatedHours]
  )

  async function handleSave() {
    setError('')
    if (!name.trim()) {
      setError('Enter a service name.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        pricing_type: pricingType,
        flat_rate: pricingType === 'flat' && flatRate !== '' ? num(flatRate) : null,
        hourly_rate: pricingType === 'hourly' && hourlyRate !== '' ? num(hourlyRate) : null,
        estimated_hours: pricingType === 'hourly' && estimatedHours !== '' ? num(estimatedHours) : null,
        sort_order: num(sortOrder),
        active,
      }

      if (isNew) {
        // facility_id is set server-side by a BEFORE INSERT trigger.
        const { error: err } = await supabase.from('biz_service_catalog').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_service_catalog')
          .update(payload)
          .eq('id', service.id)
        if (err) throw err
      }
      router.push('/admin/services')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this service? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    const { error: err } = await supabase.from('biz_service_catalog').delete().eq('id', service.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/admin/services')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader title={isNew ? 'New Service' : 'Edit Service'} />

      <div className="body">
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label className="label">Name *</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label className="label">Description</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Category</label>
          <input
            style={inputStyle}
            placeholder="e.g. HVAC, Plumbing, Electrical"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        {/* Pricing type toggle */}
        <div className="field">
          <label className="label">Pricing Type</label>
          <div className="toggle">
            <button
              type="button"
              className={`toggle-btn ${pricingType === 'flat' ? 'on' : ''}`}
              onClick={() => setPricingType('flat')}
            >
              Flat Rate
            </button>
            <button
              type="button"
              className={`toggle-btn ${pricingType === 'hourly' ? 'on' : ''}`}
              onClick={() => setPricingType('hourly')}
            >
              Hourly
            </button>
          </div>
        </div>

        {pricingType === 'flat' ? (
          <div className="field">
            <label className="label">Flat Rate ($)</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="any"
              value={flatRate}
              onChange={(e) => setFlatRate(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label className="label">Hourly Rate ($/hr)</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="any"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">Estimated Hours</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="any"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
            {estTotal > 0 && (
              <div className="est">
                Est. total: <strong>${estTotal.toFixed(2)}</strong> based on {num(estimatedHours)} hour
                {num(estimatedHours) === 1 ? '' : 's'}
              </div>
            )}
          </>
        )}

        <div className="field">
          <label className="label">Sort Order</label>
          <input
            style={inputStyle}
            type="number"
            step="1"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>

        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active</span>
        </label>
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
        .toggle {
          display: flex;
          gap: 8px;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px 0;
          border: 1.5px solid ${C_BORDER};
          border-radius: 6px;
          background: #fff;
          color: ${C_MUTED};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .toggle-btn.on {
          background: ${C};
          border-color: ${C};
          color: #fff;
        }
        .est {
          background: #f5f8ff;
          border: 1.5px solid ${C_BORDER};
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 14px;
          color: ${C_MUTED};
          margin-bottom: 16px;
        }
        .est strong {
          color: ${C};
        }
        .check {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          color: ${C};
          cursor: pointer;
        }
        .check input {
          width: 18px;
          height: 18px;
          accent-color: ${C};
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
