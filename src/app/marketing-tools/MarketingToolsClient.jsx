'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

const BLUE = '#1a56a0'
const MUTED = '#5580a0'
const DIVIDER = '1.5px solid #d0e0f4'
const HEALTH = { red: '#fde8e8', amber: '#fff4e0', blue: '#f0f6ff', green: '#dcf5e8' }
const HEALTH_TX = { red: '#b02020', amber: '#a35a00', blue: BLUE, green: '#1a7a42' }

const DAY = 86400000

/* The three design generators, in launcher order. */
const TOOLS = [
  { href: '/marketing-tools/logo', name: 'Logo Generator', emoji: '🎨', desc: 'Generate a logo with AI or build one from a name, icon, and color.' },
  { href: '/marketing-tools/business-card', name: 'Business Card Generator', emoji: '💼', desc: 'Design a printable business card from your details.' },
  { href: '/marketing-tools/flyer', name: 'Flyer Generator', emoji: '📰', desc: 'Create a promo, event, or announcement flyer.' },
]

/* ───────────────────────── helpers ───────────────────────── */
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)
const ageDays = (iso, now) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null)
const hasEmail = (c) => !!(c.email && c.email.includes('@'))
const hasPhone = (c) => !!(c.phone && c.phone.replace(/\D/g, '').length >= 7)
const hasAddress = (c) => !!((c.city && c.state) || c.zip)
const contactName = (c) =>
  c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—'

function exportCsv(rows, filename) {
  const cols = ['company_name', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip']
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ───────────────────────── primitives ───────────────────────── */
function Section({ title, children, right = null }) {
  return (
    <div style={{ borderBottom: DIVIDER }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 4px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
        {right}
      </div>
      <div style={{ padding: '4px 16px 14px' }}>{children}</div>
    </div>
  )
}

function KpiCard({ label, value, sub, health = 'blue', note }) {
  return (
    <div style={{ background: HEALTH[health], borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: HEALTH_TX[health], lineHeight: 1.15, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
      {note && <div style={{ fontSize: 10, color: '#8a98ac', fontStyle: 'italic', marginTop: 3 }}>{note}</div>}
    </div>
  )
}

function Callout({ tone = 'info', children }) {
  const map = {
    info: { bg: '#eef5ff', br: BLUE },
    warn: { bg: '#fff8e8', br: '#b58100' },
    danger: { bg: '#fff6f6', br: '#b02020' },
  }
  const c = map[tone] || map.info
  return (
    <div style={{ background: c.bg, borderLeft: `3px solid ${c.br}`, padding: '10px 12px', fontSize: 12.5, color: '#33414f', lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

/* ───────────────────────── main ───────────────────────── */
export default function MarketingToolsClient() {
  const router = useRouter()
  const [now] = useState(() => Date.now())
  const [view, setView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [customers, setCustomers] = useState([])

  // Load the facility's contacts client-side. RLS scopes rows to the caller's
  // facility, so no explicit filter is needed. select('*') tolerates schema
  // drift (we read whatever columns exist and compute defensively).
  async function loadData() {
    setLoading(true); setErr('')
    try {
      const { data, error } = await supabase
        .from('biz_customers')
        .select('*')
        .order('created_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      setCustomers(data || [])
    } catch (e) {
      setErr(e.message || 'Failed to load contacts')
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch-then-setState on mount is the intended pattern here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [])

  /* ── compute everything from the contact base ── */
  const m = useMemo(() => {
    const list = customers
    const total = list.length

    const withEmail = list.filter(hasEmail)
    const withPhone = list.filter(hasPhone)
    const withAddress = list.filter(hasAddress)
    const complete = list.filter((c) => hasEmail(c) && hasPhone(c) && hasAddress(c))
    const reachable = list.filter((c) => hasEmail(c) || hasPhone(c))

    const emailRate = pct(withEmail.length, total)
    const phoneRate = pct(withPhone.length, total)
    const addressRate = pct(withAddress.length, total)
    const completeRate = pct(complete.length, total)
    const reachableRate = pct(reachable.length, total)

    // week-over-week growth (needs created_at; degrades to 0 if absent)
    const inWindow = (iso, startAgo, endAgo) => {
      if (!iso) return false
      const t = new Date(iso).getTime()
      return t >= now - startAgo && t < now - endAgo
    }
    const addedThis = list.filter((c) => inWindow(c.created_at, 7 * DAY, 0)).length
    const addedPrev = list.filter((c) => inWindow(c.created_at, 14 * DAY, 7 * DAY)).length
    const hasDates = list.some((c) => c.created_at)

    // 8-week add trend
    const weeks = []
    for (let w = 7; w >= 0; w--) {
      const start = now - (w + 1) * 7 * DAY
      const end = now - w * 7 * DAY
      weeks.push(list.filter((c) => c.created_at && new Date(c.created_at).getTime() >= start && new Date(c.created_at).getTime() < end).length)
    }

    // top regions by state
    const stateMap = {}
    for (const c of list) {
      const s = (c.state || '').trim().toUpperCase()
      if (s) stateMap[s] = (stateMap[s] || 0) + 1
    }
    const topStates = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([state, count]) => ({ state, count }))

    // ── worklists: close the gaps that block marketing ──
    const byNewest = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    const missingEmail = list.filter((c) => !hasEmail(c)).sort(byNewest)
    const missingPhone = list.filter((c) => !hasPhone(c)).sort(byNewest)
    const missingAddress = list.filter((c) => !hasAddress(c)).sort(byNewest)
    const noNotes = list.filter((c) => !(c.notes && c.notes.trim())).sort(byNewest)
    const recentlyAdded = list.filter((c) => c.created_at && now - new Date(c.created_at).getTime() <= 7 * DAY).sort(byNewest)

    return {
      total, withEmail, withPhone, withAddress, reachable,
      emailRate, phoneRate, addressRate, completeRate, reachableRate,
      addedThis, addedPrev, hasDates, weeks, topStates,
      lists: { missingEmail, missingPhone, missingAddress, noNotes, recentlyAdded },
    }
  }, [customers, now])

  /* ── TL;DR: the one thing that matters today ── */
  const tldr = useMemo(() => {
    if (!m.total) {
      return { tone: 'info', text: 'No contacts yet. Add your customers in the Contacts tab — a clean contact list is the fuel for every campaign you run.', cta: null }
    }
    if (m.emailRate < 60) {
      return { tone: 'danger', text: `Only ${m.emailRate}% of your ${m.total} contacts have an email address. Email is the cheapest channel you own — collect the missing ones before spending on ads.`, cta: { label: 'Fix missing emails →', go: () => setView('contacts') } }
    }
    if (m.completeRate < 70) {
      return { tone: 'warn', text: `${m.completeRate}% of contacts have a complete profile (email + phone + address). Filling the gaps unlocks email, SMS, and direct-mail in one list.`, cta: { label: 'Review contacts →', go: () => setView('contacts') } }
    }
    return { tone: 'info', text: 'Your contact base is clean and reachable. Spin up a campaign: design an asset, then export your email segment.', cta: { label: 'Open Campaigns →', go: () => setView('campaigns') } }
  }, [m])

  return (
    // Break out of the app-wide 480px phone column (src/app/layout.js) so the
    // dashboard can use the full screen on desktop. On phones 100vw === the phone
    // width and the negative margins resolve to ~0, so it stays compact there.
    <div style={{
      width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <PageHeader title="Marketing Dashboard" appIcon="🎯" onBack={() => router.push('/')} />

      <div style={{ display: 'flex', borderBottom: DIVIDER, overflowX: 'auto' }}>
        {[['dashboard', 'Dashboard'], ['design', 'Design Tools'], ['contacts', 'Contacts'], ['campaigns', 'Campaigns']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{
              flex: '1 0 auto', padding: '11px 16px', background: view === id ? '#e8f0fb' : '#fff', border: 'none',
              borderBottom: view === id ? `2.5px solid ${BLUE}` : '2.5px solid transparent',
              color: view === id ? BLUE : MUTED, fontWeight: view === id ? 700 : 500,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {view === 'dashboard' && (
            <DashboardView m={m} tldr={tldr} loading={loading} err={err} now={now} onReload={loadData} router={router} />
          )}
          {view === 'design' && <DesignToolsView router={router} />}
          {view === 'contacts' && <ContactsView m={m} loading={loading} now={now} router={router} />}
          {view === 'campaigns' && <CampaignsView m={m} router={router} />}
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Dashboard tab ───────────────────────── */
function DashboardView({ m, tldr, loading, err, now, onReload, router }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#f5f8ff', borderBottom: DIVIDER }}>
        <div style={{ fontSize: 12, color: '#888' }}>{loading ? 'Loading…' : `${m.total} contact${m.total === 1 ? '' : 's'} · live`}</div>
        <button onClick={onReload} disabled={loading}
          style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {err && <div style={{ padding: '8px 16px', fontSize: 12, color: '#b02020', background: '#fde8e8', borderBottom: DIVIDER }}>{err}</div>}

      {!loading && (
        <>
          {tldr && (
            <div style={{ padding: '12px 16px', borderBottom: DIVIDER, background: tldr.tone === 'danger' ? '#fff6f6' : tldr.tone === 'warn' ? '#fffaf0' : '#f0fff6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: tldr.tone === 'info' ? '#1a7a42' : '#b02020', textTransform: 'uppercase', marginBottom: 4 }}>
                {tldr.tone === 'info' ? '✓ The one thing today' : '⚠ The one thing today'}
              </div>
              <div style={{ fontSize: 14, color: tldr.tone === 'info' ? '#1a7a42' : '#b02020', lineHeight: 1.5 }}>{tldr.text}</div>
              {tldr.cta && (
                <button onClick={tldr.cta.go}
                  style={{ marginTop: 8, background: BLUE, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {tldr.cta.label}
                </button>
              )}
            </div>
          )}

          {/* Scorecard */}
          <Section title="This week vs last week">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Scorecard label="New contacts" cur={m.addedThis} prev={m.hasDates ? m.addedPrev : null} />
              <Scorecard label="Total contacts" cur={m.total} prev={null} />
              <Scorecard label="Reachable (email/phone)" cur={m.reachable.length} prev={null} />
              <Scorecard label="With email" cur={m.withEmail.length} prev={null} />
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
              {m.hasDates ? 'Green arrows mean your list is growing — keep adding every new customer.' : 'Growth-over-time needs contact dates; add new customers and the trend will fill in.'}
            </div>
          </Section>

          {/* KPI grid */}
          <Section title="The numbers that matter">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 10 }}>
              <KpiCard label="Total contacts" value={m.total} sub="your owned audience" health="blue" />
              <KpiCard label="Email coverage" value={`${m.emailRate}%`} sub={`${m.withEmail.length} of ${m.total} · target ≥80%`} health={m.emailRate >= 80 ? 'green' : m.emailRate >= 50 ? 'amber' : 'red'} />
              <KpiCard label="Phone coverage" value={`${m.phoneRate}%`} sub={`${m.withPhone.length} reachable by SMS/call`} health={m.phoneRate >= 70 ? 'green' : m.phoneRate >= 40 ? 'amber' : 'red'} />
              <KpiCard label="Mailing address" value={`${m.addressRate}%`} sub="usable for direct mail" health={m.addressRate >= 60 ? 'green' : m.addressRate >= 30 ? 'amber' : 'red'} />
              <KpiCard label="Complete profiles" value={`${m.completeRate}%`} sub="email + phone + address" health={m.completeRate >= 70 ? 'green' : m.completeRate >= 40 ? 'amber' : 'red'} />
              <KpiCard label="Reachable" value={`${m.reachableRate}%`} sub="email or phone on file" health={m.reachableRate >= 90 ? 'green' : m.reachableRate >= 60 ? 'amber' : 'red'} />
            </div>
          </Section>

          {/* Growth + regions */}
          <Section title="Contact growth & top regions">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <GrowthTrend weeks={m.weeks} hasDates={m.hasDates} />
              <Regions topStates={m.topStates} />
            </div>
          </Section>

          {/* Action queue */}
          <Section title="Do this next">
            <ActionCard tone="fire" title="Missing an email address" leads={m.lists.missingEmail} now={now}
              coaching="Email is the cheapest channel you own. Find these from invoices, calls, or your website and add them."
              primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
            <ActionCard title="Missing a phone number" leads={m.lists.missingPhone} now={now}
              coaching="A phone enables SMS and follow-up calls. Capture it next time you talk to them."
              primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
            <ActionCard tone="good" title="Added in the last 7 days" leads={m.lists.recentlyAdded} now={now}
              coaching="Fresh contacts. Send a welcome and design a simple intro asset to make a first impression."
              primary={{ label: 'Make a flyer', onClick: () => router.push('/marketing-tools/flyer') }} />

            <CollapsedActions>
              <ActionCard compact title="Missing a mailing address" leads={m.lists.missingAddress} now={now}
                coaching="No address = no postcards or local mailers. Fill these to unlock direct mail."
                primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
              <ActionCard compact title="No notes / context" leads={m.lists.noNotes} now={now}
                coaching="A one-line note (how you met, what they bought) makes every future message more personal."
                primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
            </CollapsedActions>
          </Section>

          {/* Design quick launch */}
          <Section title="Design something now">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {TOOLS.map((t) => (
                <button key={t.href} onClick={() => router.push(t.href)}
                  style={{ textAlign: 'left', background: '#f5f8ff', border: DIVIDER, borderRadius: 8, padding: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 24 }}>{t.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BLUE, marginTop: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* Playbook */}
          <Playbook />

          {/* Honesty note */}
          <Section title="What you can & can't do yet">
            <Callout tone="warn">
              <strong>Be honest about scope:</strong> this dashboard reads your real contact list and powers the design tools and segment exports. In-app email/SMS <em>sending</em> and open/click analytics aren&apos;t wired up yet — for now, export a segment from the Campaigns tab and send it through your email provider. Don&apos;t track numbers you can&apos;t measure.
            </Callout>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <LaunchPill label="Manage contacts" onClick={() => router.push('/customers')} />
              <LaunchPill label="+ Add contact" onClick={() => router.push('/customers/new')} />
              <LaunchPill label="Design tools" onClick={() => router.push('/marketing-tools/logo')} />
            </div>
          </Section>

          <div style={{ height: 28 }} />
        </>
      )}
    </>
  )
}

/* ───────────────────────── Design Tools tab ───────────────────────── */
function DesignToolsView({ router }) {
  return (
    <div style={{ padding: 16 }}>
      <Callout tone="info">Quick generators for your brand — preview live, download a PNG. The Logo Generator can draft with AI (DALL·E 3) or let you build one by hand.</Callout>
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {TOOLS.map((tool) => (
          <div key={tool.href} onClick={() => router.push(tool.href)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: DIVIDER, borderRadius: 10, cursor: 'pointer', background: '#fff', transition: 'background 0.12s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
            <div style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{tool.emoji}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: BLUE }}>{tool.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{tool.desc}</div>
            </div>
            <span style={{ fontSize: 18, color: BLUE, fontWeight: 'bold' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────── Contacts tab ───────────────────────── */
function ContactsView({ m, loading, now, router }) {
  if (loading) return <div style={{ padding: 24, color: MUTED, fontSize: 13 }}>Loading contacts…</div>
  if (!m.total) {
    return (
      <div style={{ padding: 16 }}>
        <Callout tone="info">No contacts yet. Your contact list is the foundation of every campaign.</Callout>
        <button onClick={() => router.push('/customers/new')}
          style={{ marginTop: 12, background: BLUE, color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          + Add your first contact
        </button>
      </div>
    )
  }
  return (
    <>
      <Section title="Your audience at a glance" right={
        <button onClick={() => router.push('/customers')} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Manage all ›</button>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <KpiCard label="Total contacts" value={m.total} health="blue" />
          <KpiCard label="Have email" value={m.withEmail.length} sub={`${m.emailRate}%`} health="blue" />
          <KpiCard label="Have phone" value={m.withPhone.length} sub={`${m.phoneRate}%`} health="blue" />
          <KpiCard label="Have address" value={m.withAddress.length} sub={`${m.addressRate}%`} health="blue" />
        </div>
      </Section>

      <Section title="Gaps to close">
        <ActionCard title="Missing an email" leads={m.lists.missingEmail} now={now}
          coaching="Can't be email-marketed until you add one."
          primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
        <ActionCard compact title="Missing a phone" leads={m.lists.missingPhone} now={now}
          primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
        <ActionCard compact title="Missing a mailing address" leads={m.lists.missingAddress} now={now}
          primary={{ label: 'Open in Contacts', onClick: () => router.push('/customers') }} />
      </Section>

      <Section title="Recently added">
        {m.lists.recentlyAdded.length === 0
          ? <div style={{ fontSize: 12.5, color: MUTED }}>No contacts added in the last 7 days.</div>
          : m.lists.recentlyAdded.slice(0, 12).map((c) => <LeadMini key={c.id} lead={c} now={now} />)}
      </Section>
      <div style={{ height: 28 }} />
    </>
  )
}

/* ───────────────────────── Campaigns tab ───────────────────────── */
function CampaignsView({ m, router }) {
  const segments = [
    { key: 'email', label: 'All contacts with email', rows: m.withEmail, hint: 'For an email blast', file: 'contacts-with-email.csv' },
    { key: 'phone', label: 'All contacts with phone', rows: m.withPhone, hint: 'For SMS / call list', file: 'contacts-with-phone.csv' },
    { key: 'address', label: 'All contacts with mailing address', rows: m.withAddress, hint: 'For postcards / direct mail', file: 'contacts-with-address.csv' },
    { key: 'all', label: 'Everyone reachable', rows: m.reachable, hint: 'Anyone with an email or phone', file: 'all-contacts.csv' },
  ]
  return (
    <>
      <Section title="Run a campaign in 3 steps">
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ['1 · Pick a segment', 'Export the right slice of your contact list below (with email, with phone, or with a mailing address).'],
            ['2 · Design the asset', 'Build a logo, business card, or flyer in the Design Tools tab and download the PNG.'],
            ['3 · Send it', 'Drop the CSV into your email or SMS provider, attach your design, and send. Track replies in your inbox.'],
          ].map(([t, b]) => (
            <div key={t} style={{ background: '#f5f8ff', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: '#33414f', lineHeight: 1.5 }}>{b}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Export a contact segment">
        {!m.total ? (
          <Callout tone="info">Add contacts first — there&apos;s nothing to export yet.</Callout>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {segments.map((s) => {
              const rows = s.rows
              const count = rows.length
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, border: DIVIDER, borderRadius: 8, padding: '10px 12px' }}>
                  <span style={{ background: '#eef3fb', color: BLUE, fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '2px 10px', minWidth: 34, textAlign: 'center' }}>{count}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: BLUE }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: MUTED }}>{s.hint}</div>
                  </div>
                  <button onClick={() => exportCsv(rows, s.file)} disabled={!count}
                    style={{ background: count ? BLUE : '#c0cce0', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: count ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                    Export CSV
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#8a98ac', marginTop: 8 }}>CSV exports run entirely in your browser — nothing leaves this device until you upload it to your provider.</div>
      </Section>

      <Section title="Design the creative">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {TOOLS.map((t) => (
            <button key={t.href} onClick={() => router.push(t.href)}
              style={{ textAlign: 'left', background: '#f5f8ff', border: DIVIDER, borderRadius: 8, padding: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 24 }}>{t.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: BLUE, marginTop: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Coming soon">
        <Callout tone="warn">
          In-app email &amp; SMS sending, scheduled campaigns, and open/click analytics aren&apos;t built yet. Until they are, the export-and-send flow above is the honest, working path. When sending is wired in, your segments here become one-click campaigns.
        </Callout>
      </Section>
      <div style={{ height: 28 }} />
    </>
  )
}

/* ───────────────────────── sub-components ───────────────────────── */
function Scorecard({ label, cur, prev, invert = false }) {
  let arrow = null
  if (prev !== null && prev !== undefined) {
    const up = cur > prev, down = cur < prev
    const good = invert ? down : up
    if (up || down) arrow = <span style={{ color: good ? '#1a7a42' : '#b02020', fontSize: 13, fontWeight: 700 }}>{up ? '▲' : '▼'}</span>
  }
  return (
    <div style={{ background: '#f5f8ff', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 24, fontWeight: 600, color: BLUE, display: 'flex', alignItems: 'center', gap: 6 }}>{cur}{arrow}</div>
      <div style={{ fontSize: 12.5, color: MUTED }}>{label}</div>
      {prev !== null && prev !== undefined && <div style={{ fontSize: 11, color: '#8a98ac' }}>was {prev} last wk</div>}
    </div>
  )
}

function LeadMini({ lead, now }) {
  const d = ageDays(lead.created_at, now)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: BLUE, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '46%' }}>{contactName(lead)}</span>
      <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{lead.email || lead.phone || 'no contact info'}</span>
      <span style={{ color: MUTED, flexShrink: 0 }}>{d === null ? '' : `${d}d`}</span>
    </div>
  )
}

function ActionCard({ title, leads = [], coaching, primary, tone = 'normal', compact = false, now }) {
  const count = leads.length
  const badgeColor = tone === 'fire' ? '#b02020' : tone === 'good' ? '#1a7a42' : BLUE
  const badgeBg = tone === 'fire' ? '#fde8e8' : tone === 'good' ? '#dcf5e8' : '#eef3fb'
  const shown = leads.slice(0, compact ? 4 : 6)
  return (
    <div style={{
      border: tone === 'fire' ? '1.5px solid #f0baba' : DIVIDER,
      background: tone === 'fire' ? '#fff8f8' : '#fff',
      borderRadius: 8, padding: '10px 12px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: badgeBg, color: badgeColor, fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '2px 10px', minWidth: 30, textAlign: 'center' }}>{count}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: BLUE }}>{title}</div>
          {coaching && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{coaching}</div>}
        </div>
      </div>
      {count > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 2 }}>
          {shown.map((l) => <LeadMini key={l.id} lead={l} now={now} />)}
          {count > shown.length && <div style={{ fontSize: 11, color: '#8a98ac', marginTop: 2 }}>+{count - shown.length} more</div>}
          {primary && (
            <div style={{ marginTop: 8 }}>
              <button onClick={primary.onClick}
                style={{ background: '#fff', color: BLUE, border: `1.5px solid ${BLUE}`, borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {primary.label} ›
              </button>
            </div>
          )}
        </div>
      )}
      {count === 0 && <div style={{ fontSize: 12, color: '#1a7a42', marginTop: 6 }}>✓ Nothing here — nice.</div>}
    </div>
  )
}

function CollapsedActions({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
        {open ? '▾ Hide more lists' : '▸ Show 2 more housekeeping lists'}
      </button>
      {open && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}

function GrowthTrend({ weeks, hasDates }) {
  const hasData = hasDates && weeks.some((v) => v > 0)
  const W = 240, H = 70, pad = 6
  const maxV = Math.max(1, ...weeks)
  const pts = weeks.map((v, i) => {
    const x = pad + (i / (weeks.length - 1)) * (W - pad * 2)
    const y = H - pad - (v / maxV) * (H - pad * 2)
    return { x, y }
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>New contacts, weekly (last 8 weeks)</div>
      {hasData ? (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <path d={line} fill="none" stroke={BLUE} strokeWidth="2" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={BLUE} />)}
        </svg>
      ) : (
        <div style={{ fontSize: 12, color: '#8a98ac', padding: '16px 0' }}>Not enough dated contacts yet to plot a trend.</div>
      )}
      <div style={{ fontSize: 11, color: '#8a98ac', marginTop: 4 }}>Up and to the right means your audience is growing.</div>
    </div>
  )
}

function Regions({ topStates }) {
  const max = Math.max(1, ...topStates.map((s) => s.count))
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Top regions (by state)</div>
      {topStates.length === 0 ? (
        <div style={{ fontSize: 12, color: '#8a98ac', padding: '16px 0' }}>No state data on your contacts yet.</div>
      ) : topStates.map((s) => (
        <div key={s.state} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: MUTED, width: 40, flexShrink: 0 }}>{s.state}</span>
          <div style={{ flex: 1, background: '#f0f6ff', borderRadius: 3, height: 16 }}>
            <div style={{ width: `${Math.max(4, (s.count / max) * 100)}%`, height: '100%', background: BLUE, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: BLUE, width: 30, textAlign: 'right', flexShrink: 0 }}>{s.count}</span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#8a98ac', marginTop: 4 }}>Concentrate local outreach where your customers already cluster.</div>
    </div>
  )
}

function LaunchPill({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: '#fff', color: BLUE, border: `1.5px solid ${BLUE}`, borderRadius: 16, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  )
}

const PLAYBOOK = [
  ['Own your list, don\'t rent attention', 'Ads stop the moment you stop paying. Your contact list is an asset you own forever — every email and phone number you capture is cheaper pipeline than the next ad click.'],
  ['Get the email first', 'A name with no email can\'t be marketed to. Make capturing an email the one non-negotiable at every sale, quote, and service call.'],
  ['One message, one ask', 'Short, personal, a single clear call to action. "Here\'s 10% off your next service — book by Friday" beats a wall of text every time.'],
  ['Use what you build here', 'A consistent logo, card, and flyer make a one-person shop look established. Generate them once, reuse them everywhere — email signature, invoices, social.'],
  ['Segment simply', 'You don\'t need fancy tools: split by what you have. Email list for newsletters, phone list for time-sensitive SMS, address list for local postcards. Export each from the Campaigns tab.'],
  ['Show up monthly, minimum', 'A quiet list goes cold. One useful message a month — a tip, an offer, an update — keeps you top-of-mind for when they\'re ready to buy.'],
  ['Mind your region', 'Most small-business demand is local. Reference your town, your area, nearby landmarks — sound like a neighbor, not a national brand.'],
  ['What "good" looks like', 'Email on ≥80% of contacts · a complete profile on most · a fresh design asset on hand · one campaign sent per month · every new customer added the day you meet them.'],
]

function Playbook() {
  const [open, setOpen] = useState(false)
  return (
    <Section title="Playbook — the motion, in plain English" right={
      <button onClick={() => setOpen((o) => !o)} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        {open ? '▾ Hide' : '▸ Open'}
      </button>
    }>
      {open ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {PLAYBOOK.map(([t, b]) => (
            <div key={t} style={{ background: '#f5f8ff', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: '#33414f', lineHeight: 1.5 }}>{b}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: MUTED }}>Tap “Open” for the small-business marketing motion — own your list, capture emails, and turn contacts into repeat business.</div>
      )}
    </Section>
  )
}
