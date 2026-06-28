'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import ImageUploadField from '@/components/ui/ImageUploadField'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

// US timezones (IANA names) for the dropdown.
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const LOGIN_METHODS = ['email', 'microsoft', 'google']

// Plain text fields rendered in order.
const TEXT_FIELDS = [
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
]

// Derive a URL-safe slug from a company name.
function slugify(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function initialForm(company) {
  return {
    name: company?.name ?? '',
    slug: company?.slug ?? '',
    logo_url: company?.logo_url ?? '',
    phone: company?.phone ?? '',
    address: company?.address ?? '',
    city: company?.city ?? '',
    state: company?.state ?? '',
    zip: company?.zip ?? '',
    timezone: company?.timezone ?? 'America/New_York',
    login_method: company?.login_method ?? 'email',
    google_enabled: company?.google_enabled ?? false,
    active: company?.active ?? true,
  }
}

export default function CompanyFormClient({ company, isNew }) {
  const router = useRouter()
  const [form, setForm] = useState(() => initialForm(company))
  // Track whether the user hand-edited the slug; until then it auto-follows name.
  const [slugTouched, setSlugTouched] = useState(!isNew && !!company?.slug)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setName(value) {
    setForm((f) => ({
      ...f,
      name: value,
      slug: slugTouched ? f.slug : slugify(value),
    }))
  }

  function setSlug(value) {
    setSlugTouched(true)
    set('slug', slugify(value))
  }

  async function handleSave() {
    setError('')
    if (!form.name.trim()) {
      setError('Enter a company name.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        logo_url: form.logo_url.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        timezone: form.timezone || null,
        login_method: form.login_method || null,
        google_enabled: !!form.google_enabled,
        active: !!form.active,
      }

      if (isNew) {
        const { data: created, error: err } = await supabase
          .from('facilities')
          .insert(payload)
          .select('id')
          .single()
        if (err) throw err

        // Enable all active apps for the new company by default.
        const { data: apps } = await supabase
          .from('biz_apps')
          .select('id')
          .eq('active', true)
          .order('app_name', { ascending: true })

        if (apps && apps.length > 0) {
          const perms = apps.map((a, i) => ({
            facility_id: created.id,
            app_id: a.id,
            app_order: i,
            active: true,
          }))
          const { error: permErr } = await supabase
            .from('biz_app_permission_mains')
            .insert(perms)
          if (permErr) throw permErr
        }
      } else {
        const { error: err } = await supabase
          .from('facilities')
          .update(payload)
          .eq('id', company.id)
        if (err) throw err
      }
      router.push('/master-control/facilities')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this company? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    const { error: err } = await supabase
      .from('facilities')
      .delete()
      .eq('id', company.id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push('/master-control/facilities')
    router.refresh()
  }

  return (
    <div className="wrap">
      <PageHeader
        title={isNew ? 'New Company' : 'Edit Company'}
        onBack={() => router.push('/master-control/facilities')}
      />

      <div className="body">
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label className="label">Logo</label>
          <ImageUploadField
            value={form.logo_url}
            bucket="company-logos"
            prefix={company?.id ? `company-${company.id}` : 'company-new'}
            onChange={(url) => set('logo_url', url)}
          />
          <div className="hint">Upload a company logo image (optional).</div>
        </div>

        <div className="field">
          <label className="label">Name</label>
          <input
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Slug</label>
          <input
            className="input"
            type="text"
            value={form.slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated from name"
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
          <label className="label">Timezone</label>
          <select
            className="input"
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Login Method</label>
          <select
            className="input"
            value={form.login_method}
            onChange={(e) => set('login_method', e.target.value)}
          >
            {LOGIN_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.google_enabled}
            onChange={(e) => set('google_enabled', e.target.checked)}
          />
          <span>Google sign-in enabled</span>
        </label>

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
        .hint {
          font-size: 11px;
          color: #5580a0;
          margin-top: 6px;
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
