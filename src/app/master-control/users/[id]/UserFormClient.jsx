'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

// Roles assignable from this page. (demo is intentionally omitted — it's a
// facility-level concern, not a superuser one.)
const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'super_user', label: 'Super User' },
  { value: 'master_control', label: 'Master Control' },
]

// Plain text fields rendered in order.
const TEXT_FIELDS = [
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'cell_phone', label: 'Cell Phone', type: 'tel' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'department', label: 'Department' },
]

function fullDisplay(first, last) {
  return [first, last].filter(Boolean).join(' ').trim()
}

function initialForm(u) {
  return {
    first_name: u?.first_name ?? '',
    last_name: u?.last_name ?? '',
    email: u?.email ?? '',
    display_name: u?.display_name ?? '',
    phone: u?.phone ?? '',
    cell_phone: u?.cell_phone ?? '',
    job_title: u?.job_title ?? '',
    department: u?.department ?? '',
    facility_id: u?.facility_id ?? '',
    user_role: u?.user_role ?? 'user',
    active: u?.active ?? true,
  }
}

export default function UserFormClient({ bizUser, isNew, facilities = [] }) {
  const router = useRouter()
  const [form, setForm] = useState(() => initialForm(bizUser))
  // Track whether the user hand-edited display_name; until then it auto-follows
  // first + last name.
  const [displayTouched, setDisplayTouched] = useState(
    !isNew && !!bizUser?.display_name &&
      bizUser.display_name !== fullDisplay(bizUser.first_name, bizUser.last_name)
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setFirst(value) {
    setForm((f) => ({
      ...f,
      first_name: value,
      display_name: displayTouched ? f.display_name : fullDisplay(value, f.last_name),
    }))
  }

  function setLast(value) {
    setForm((f) => ({
      ...f,
      last_name: value,
      display_name: displayTouched ? f.display_name : fullDisplay(f.first_name, value),
    }))
  }

  function setDisplay(value) {
    setDisplayTouched(true)
    set('display_name', value)
  }

  async function handleSave() {
    setError('')
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('First name, last name, and email are required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        display_name: form.display_name.trim() || fullDisplay(form.first_name, form.last_name),
        phone: form.phone.trim() || null,
        cell_phone: form.cell_phone.trim() || null,
        job_title: form.job_title.trim() || null,
        department: form.department.trim() || null,
        facility_id: form.facility_id || null,
        user_role: form.user_role,
        active: !!form.active,
      }

      if (isNew) {
        const { error: err } = await supabase.from('biz_users').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_users')
          .update(payload)
          .eq('id', bizUser.id)
        if (err) throw err
      }
      router.push('/master-control/users')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this user? This removes their app profile but not any Supabase auth login.')) return
    setDeleting(true)
    setError('')
    const { error: err } = await supabase.from('biz_users').delete().eq('id', bizUser.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/master-control/users')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader
        title={isNew ? 'New User' : 'Edit User'}
        onBack={() => router.push('/master-control/users')}
      />

      <div className="body">
        {error && <div className="error">{error}</div>}

        {isNew && (
          <div className="note">
            Creates the user&apos;s app profile only. They&apos;ll still need to register
            (email/password or Google) so Supabase Auth can link to this record by email.
          </div>
        )}

        <div className="field">
          <label className="label">First name</label>
          <input
            className="input"
            type="text"
            value={form.first_name}
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Last name</label>
          <input
            className="input"
            type="text"
            value={form.last_name}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Display name</label>
          <input
            className="input"
            type="text"
            value={form.display_name}
            onChange={(e) => setDisplay(e.target.value)}
            placeholder="auto-generated from first + last"
          />
        </div>

        {TEXT_FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label className="label">{f.label}</label>
            <input
              className="input"
              type={f.type || 'text'}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}

        <div className="field">
          <label className="label">Company</label>
          <select
            className="input"
            value={form.facility_id}
            onChange={(e) => set('facility_id', e.target.value)}
          >
            <option value="">— Select company —</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Role</label>
          <select
            className="input"
            value={form.user_role}
            onChange={(e) => set('user_role', e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
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
        .note {
          background: #f5f8ff;
          border: 1.5px solid ${C_BORDER};
          color: #5580a0;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 12px;
          line-height: 1.45;
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
          background: #fff;
        }
        .input:focus {
          border-color: ${C};
        }
        .check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          font-size: 15px;
          color: ${C};
          font-weight: 600;
          cursor: pointer;
        }
        .check-row input {
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
