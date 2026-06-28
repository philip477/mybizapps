'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'
const C_MUTED = '#5580a0'

// Kebab-case a name into a URL/slug-safe identifier.
function slugify(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function ModuleFormClient({ moduleRow, isNew }) {
  const router = useRouter()
  const [form, setForm] = useState(() => ({
    icon: moduleRow?.icon ?? '',
    name: moduleRow?.name ?? '',
    slug: moduleRow?.slug ?? '',
    description: moduleRow?.description ?? '',
    price_yearly: moduleRow?.price_yearly ?? '',
    is_base: moduleRow?.is_base ?? false,
    active: moduleRow?.active ?? true,
    sort_order: moduleRow?.sort_order ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError('')
    if (!form.name.trim()) {
      setError('Module name is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description.trim() || null,
        icon: form.icon.trim() || null,
        // Base Platform modules are bundled into the platform fee, so their
        // add-on price is always 0.
        price_yearly: form.is_base
          ? 0
          : form.price_yearly === '' || form.price_yearly === null
            ? 0
            : Number(form.price_yearly),
        is_base: !!form.is_base,
        active: !!form.active,
        sort_order:
          form.sort_order === '' || form.sort_order === null
            ? 0
            : Number(form.sort_order),
      }

      if (isNew) {
        const { error: err } = await supabase.from('biz_modules').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('biz_modules')
          .update(payload)
          .eq('id', moduleRow.id)
        if (err) throw err
      }
      router.push('/master-control/modules')
      router.refresh()
    } catch (err) {
      // Surface the unique-slug collision in plain language.
      const msg =
        err?.code === '23505'
          ? 'That slug is already used by another moduleRow. Choose a different one.'
          : err?.message || 'Save failed'
      setError(msg)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${moduleRow.name}" module? This cannot be undone.`)) return
    setDeleting(true)
    setError('')
    const { error: err } = await supabase
      .from('biz_modules')
      .delete()
      .eq('id', moduleRow.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/master-control/modules')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader title={isNew ? 'New Module' : 'Edit Module'} />

      <div className="body">
        {error && <div className="error">{error}</div>}

        <div className="row2">
          <div className="field icon-field">
            <label className="label">Icon</label>
            <input
              className="input"
              value={form.icon}
              onChange={(e) => set('icon', e.target.value)}
              placeholder="📦"
              maxLength={4}
            />
          </div>
          <div className="field grow">
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Billing Module"
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Slug</label>
          <input
            className="input"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            placeholder={slugify(form.name) || 'billing-module'}
          />
          <div className="hint">Lowercase id, e.g. <code>billing</code>. Auto-filled from the name if left blank.</div>
        </div>

        <div className="field">
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <button
          type="button"
          className={`toggle ${form.is_base ? 'on' : ''}`}
          onClick={() => set('is_base', !form.is_base)}
        >
          <span className="t-knob" />
          <span className="t-label">
            Included in the Base Platform
            <span className="t-sub">Core module — no separate add-on price</span>
          </span>
        </button>

        {!form.is_base && (
          <div className="field">
            <label className="label">Price ($ / year)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={form.price_yearly}
              onChange={(e) => set('price_yearly', e.target.value)}
              placeholder="250"
            />
            <div className="hint">Month-to-month is derived automatically (annual ÷ 12 + 10%).</div>
          </div>
        )}

        <div className="row2">
          <div className="field grow">
            <label className="label">Sort order</label>
            <input
              className="input"
              type="number"
              step="1"
              value={form.sort_order}
              onChange={(e) => set('sort_order', e.target.value)}
              placeholder="0"
            />
          </div>
          <button
            type="button"
            className={`toggle inline ${form.active ? 'on' : ''}`}
            onClick={() => set('active', !form.active)}
          >
            <span className="t-knob" />
            <span className="t-label">Active</span>
          </button>
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
        .row2 {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }
        .grow {
          flex: 1;
        }
        .icon-field {
          width: 72px;
          flex-shrink: 0;
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
        .hint {
          font-size: 12px;
          color: ${C_MUTED};
          margin-top: 4px;
        }
        .hint code {
          background: #f0f4fa;
          border-radius: 3px;
          padding: 0 4px;
        }
        .toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 1.5px solid ${C_BORDER};
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
        }
        .toggle.inline {
          width: auto;
          margin-bottom: 16px;
          flex: 1;
        }
        .toggle .t-knob {
          width: 40px;
          height: 24px;
          border-radius: 999px;
          background: #cdd9e8;
          position: relative;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .toggle .t-knob::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.15s;
        }
        .toggle.on .t-knob {
          background: ${C};
        }
        .toggle.on .t-knob::after {
          transform: translateX(16px);
        }
        .t-label {
          font-size: 14px;
          font-weight: 600;
          color: ${C};
          display: flex;
          flex-direction: column;
        }
        .t-sub {
          font-size: 12px;
          font-weight: 400;
          color: ${C_MUTED};
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
