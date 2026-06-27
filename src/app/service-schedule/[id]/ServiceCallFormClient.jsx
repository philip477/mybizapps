'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

const STATUSES = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'en_route', label: 'En Route' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const RECURRENCE = [
  { key: 'one-time', label: 'One-time' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Biweekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
]

function customerLabel(c) {
  if (c.company_name) return c.company_name
  const person = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  return person || 'Unnamed'
}

function techLabel(t) {
  const name = `${t.first_name || ''} ${t.last_name || ''}`.trim()
  return name || t.email || 'Unnamed'
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

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C, marginBottom: 4 }

export default function ServiceCallFormClient({ isNew, call, customers = [], serviceTypes = [], techs = [] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: call?.title || '',
    customer_id: call?.customer_id || '',
    service_type_id: call?.service_type_id || '',
    assigned_tech: call?.assigned_tech || '',
    scheduled_date: call?.scheduled_date ? call.scheduled_date.split('T')[0] : '',
    scheduled_time: call?.scheduled_time ? call.scheduled_time.slice(0, 5) : '',
    duration_minutes: call?.duration_minutes ?? '',
    status: call?.status || 'scheduled',
    // recurrence and notes have no columns in biz_service_calls yet — kept in
    // the UI per spec but not persisted (see handleSave).
    recurrence: 'one-time',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Only columns that exist on biz_service_calls are written here. recurrence
  // and notes are intentionally excluded (no DB columns).
  function buildPayload() {
    return {
      title: form.title.trim() || null,
      customer_id: form.customer_id || null,
      service_type_id: form.service_type_id || null,
      assigned_tech: form.assigned_tech || null,
      scheduled_date: form.scheduled_date || null,
      scheduled_time: form.scheduled_time || null,
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      status: form.status,
    }
  }

  async function handleSave() {
    setError('')
    if (!form.customer_id) {
      setError('Please choose a customer.')
      return
    }
    if (!form.scheduled_date) {
      setError('Please choose a date.')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isNew) {
        payload.facility_id = localStorage.getItem('biz_facility_id')
        const { error: err } = await supabase.from('biz_service_calls').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_service_calls')
          .update(payload)
          .eq('id', call.id)
        if (err) throw err
      }
      router.push('/service-schedule')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  // Tech quick-actions: update status + timestamps in place.
  async function updateStatus(status) {
    setStatusBusy(true)
    setError('')
    const patch = { status }
    const nowIso = new Date().toISOString()
    if (status === 'in_progress' && !call?.started_at) patch.started_at = nowIso
    if (status === 'completed') {
      patch.completed_at = nowIso
      if (!call?.started_at) patch.started_at = nowIso
    }
    const { error: err } = await supabase
      .from('biz_service_calls')
      .update(patch)
      .eq('id', call.id)
    if (err) {
      setError(err.message)
      setStatusBusy(false)
      return
    }
    router.push('/service-schedule')
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this service call?')) return
    setDeleting(true)
    const { error: err } = await supabase.from('biz_service_calls').delete().eq('id', call.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/service-schedule')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader title={isNew ? 'Schedule Service' : 'Edit Service Call'} />

      <div className="body">
        {error && <div className="error">{error}</div>}

        {/* Tech quick actions (edit only) */}
        {!isNew && (
          <div className="quick">
            <button
              className="q-btn q-start"
              onClick={() => updateStatus('in_progress')}
              disabled={statusBusy}
            >
              ▶ Start
            </button>
            <button
              className="q-btn q-complete"
              onClick={() => updateStatus('completed')}
              disabled={statusBusy}
            >
              ✓ Complete
            </button>
          </div>
        )}

        <div className="field">
          <label style={labelStyle}>Title</label>
          <input
            style={inputStyle}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. AC tune-up"
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Customer *</label>
          <select
            style={inputStyle}
            value={form.customer_id}
            onChange={(e) => set('customer_id', e.target.value)}
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label style={labelStyle}>Service Type</label>
          <select
            style={inputStyle}
            value={form.service_type_id}
            onChange={(e) => set('service_type_id', e.target.value)}
          >
            <option value="">Select a service type…</option>
            {serviceTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label style={labelStyle}>Assigned Tech</label>
          <select
            style={inputStyle}
            value={form.assigned_tech}
            onChange={(e) => set('assigned_tech', e.target.value)}
          >
            <option value="">Unassigned</option>
            {techs.map((t) => {
              const lbl = techLabel(t)
              return (
                <option key={t.id} value={lbl}>
                  {lbl}
                </option>
              )
            })}
          </select>
        </div>

        <div className="row2">
          <div className="field" style={{ flex: 1 }}>
            <label style={labelStyle}>Date *</label>
            <input
              style={inputStyle}
              type="date"
              value={form.scheduled_date}
              onChange={(e) => set('scheduled_date', e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label style={labelStyle}>Time</label>
            <input
              style={inputStyle}
              type="time"
              value={form.scheduled_time}
              onChange={(e) => set('scheduled_time', e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label style={labelStyle}>Duration (minutes)</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            step="15"
            value={form.duration_minutes}
            onChange={(e) => set('duration_minutes', e.target.value)}
            placeholder="e.g. 60"
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Recurrence</label>
          <select
            style={inputStyle}
            value={form.recurrence}
            onChange={(e) => set('recurrence', e.target.value)}
          >
            {RECURRENCE.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label style={labelStyle}>Status</label>
          <select
            style={inputStyle}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
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
        .quick {
          display: flex;
          gap: 10px;
          margin-bottom: 18px;
        }
        .q-btn {
          flex: 1;
          border-radius: 6px;
          padding: 12px 0;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          border: 1.5px solid;
        }
        .q-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .q-start {
          background: #fff5e6;
          color: #e06d1f;
          border-color: #e06d1f;
        }
        .q-complete {
          background: #e1f3e7;
          color: #1a7a42;
          border-color: #1a7a42;
        }
        .field {
          margin-bottom: 16px;
        }
        .row2 {
          display: flex;
          gap: 10px;
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
