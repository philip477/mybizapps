'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

const APP_TYPES = ['User App', 'Admin Only', 'Master Control']

function initialForm(app) {
  return {
    app_name: app?.app_name ?? '',
    app_link: app?.app_link ?? '',
    admin_link: app?.admin_link ?? '',
    app_icon_emoji: app?.app_icon_emoji ?? '',
    app_type: app?.app_type ?? 'User App',
    description: app?.description ?? '',
    sort_order: app?.sort_order ?? 0,
    active: app?.active ?? true,
  }
}

export default function AppFormClient({ app, isNew }) {
  const router = useRouter()
  const [form, setForm] = useState(() => initialForm(app))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError('')
    if (!form.app_name.trim()) {
      setError('Enter an app name.')
      return
    }
    setSaving(true)
    try {
      const sortOrder = Number.parseInt(form.sort_order, 10)
      const payload = {
        app_name: form.app_name.trim(),
        app_link: form.app_link.trim() || null,
        admin_link: form.admin_link.trim() || null,
        app_icon_emoji: form.app_icon_emoji.trim() || null,
        app_type: form.app_type,
        description: form.description.trim() || null,
        sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
        active: !!form.active,
      }

      if (isNew) {
        const { error: err } = await supabase.from('biz_apps').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_apps')
          .update(payload)
          .eq('id', app.id)
        if (err) throw err
      }
      router.push('/master-control/apps')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this app? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    const { error: err } = await supabase
      .from('biz_apps')
      .delete()
      .eq('id', app.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/master-control/apps')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader
        title={isNew ? 'New App' : 'Edit App'}
        onBack={() => router.push('/master-control/apps')}
      />

      <div className="body">
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label className="label">App Name</label>
          <input
            className="input"
            type="text"
            value={form.app_name}
            onChange={(e) => set('app_name', e.target.value)}
            placeholder="e.g. Customers"
          />
        </div>

        <div className="field">
          <label className="label">App Link</label>
          <input
            className="input"
            type="text"
            value={form.app_link}
            onChange={(e) => set('app_link', e.target.value)}
            placeholder="/customers"
          />
        </div>

        <div className="field">
          <label className="label">Admin Link</label>
          <input
            className="input"
            type="text"
            value={form.admin_link}
            onChange={(e) => set('admin_link', e.target.value)}
            placeholder="optional — e.g. /customers/admin"
          />
        </div>

        <div className="field">
          <label className="label">Icon (emoji)</label>
          <input
            className="input"
            type="text"
            value={form.app_icon_emoji}
            onChange={(e) => set('app_icon_emoji', e.target.value)}
            placeholder="📦"
          />
        </div>

        <div className="field">
          <label className="label">App Type</label>
          <select
            className="input"
            value={form.app_type}
            onChange={(e) => set('app_type', e.target.value)}
          >
            {APP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Description</label>
          <textarea
            className="input textarea"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
          />
        </div>

        <div className="field">
          <label className="label">Sort Order</label>
          <input
            className="input"
            type="number"
            value={form.sort_order}
            onChange={(e) => set('sort_order', e.target.value)}
          />
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
        .textarea {
          resize: vertical;
          min-height: 72px;
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
