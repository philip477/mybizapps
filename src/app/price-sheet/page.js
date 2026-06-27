import './price-sheet.css'
import PrintButton from './PrintButton'

// Public, printable per-module price sheet for MyBizApps. "/price-sheet" is
// allowlisted in proxy.js so unauthenticated visitors can reach it.
export const metadata = {
  title: 'MyBizApps — Price Sheet',
  robots: { index: false, follow: false },
}

const BASE_COST = 1000
const MODULE_COST = 250

// Always included in the Base Platform.
const CORE = [
  { icon: '👥', name: 'Customer Management', desc: 'Every customer, contact, and job history in one searchable place.' },
  { icon: '📇', name: 'Employee Directory', desc: 'Who works here, their role, and how to reach them — drives access across your apps.' },
  { icon: '📈', name: 'Management', desc: 'Dashboards and reporting for owners and managers.' },
]

// Optional add-on modules, each priced per year.
const MODULES = [
  { icon: '🧾', name: 'Billing Module', desc: 'Build and email quotes and invoices, and track payments.' },
  { icon: '🗓️', name: 'Service Scheduling', desc: 'Dispatch jobs and recurring service; sync field and office.' },
  { icon: '🔑', name: 'Customer Portal', desc: 'Customers view invoices, requests, and updates online.' },
  { icon: '🌐', name: 'Informational Website', desc: 'A simple public website, kept in sync with your apps.' },
  { icon: '📦', name: 'Manage Assets', desc: 'Track equipment and tools with maintenance history.' },
  { icon: '🤖', name: 'AI Office Helpers', desc: 'AI that drafts, summarizes, and automates office work.', disclaimer: '+ AI usage costs' },
  { icon: '📊', name: 'Accounting', desc: 'Track income and expenses; see where the money goes.' },
]

const fmt = (n) => '$' + n.toLocaleString('en-US')
// Month-to-month price: annual ÷ 12 plus a 10% surcharge (the premium for no
// annual commitment). Rounded to the dollar.
const fmtMo = (n) => '$' + Math.round((n / 12) * 1.1).toLocaleString('en-US')

export default function PriceSheetPage() {
  return (
    <div className="ps">
      <div className="toolbar">
        <PrintButton />
      </div>

      <div className="sheet">
        <div className="head">
          <div className="lockup">
            <img src="/images/mybizapps-logo.png" alt="MyBizApps" />
            <div className="tag">All-in-one operations software for small business</div>
          </div>
          <div className="head-right">
            <div className="label">Price Sheet</div>
            <div className="sub">Annual or month-to-month · per business</div>
            <div className="sub">www.mybizapps.app</div>
          </div>
        </div>

        <hr className="brand-divider" />

        <div className="platform">
          <div className="icon">⚙️</div>
          <div>
            <div className="name">Base Platform</div>
            <div className="desc">Customer management, employee directory, and management dashboards included — add any modules below to build the platform your business needs.</div>
          </div>
          <div className="price">
            <div className="amt">{fmt(BASE_COST)}</div>
            <div className="per">per year</div>
            <div className="permo">{fmtMo(BASE_COST)}/mo</div>
          </div>
        </div>

        <div className="sec core">✅ Included in the Base Platform</div>
        <div className="grid-core">
          {CORE.map((c) => (
            <div className="card core-card" key={c.name}>
              <div className="ci">{c.icon}</div>
              <div className="cn">{c.name}</div>
              <div className="cd">{c.desc}</div>
              <div className="cf">Included ✓</div>
            </div>
          ))}
        </div>

        <div className="sec addons">🧩 Add-On Modules</div>
        <div className="grid-addons">
          {MODULES.map((m) => (
            <div className="card addon-card" key={m.name}>
              <div className="ci">{m.icon}</div>
              <div className="cn">{m.name}</div>
              <div className="cd">{m.desc}</div>
              <div className="cf">
                <span className="add">+ Add</span>
                <span className="costwrap">
                  <span className="cost">{fmt(MODULE_COST)}/yr</span>
                  <span className="costmo">{fmtMo(MODULE_COST)}/mo</span>
                </span>
              </div>
              {m.disclaimer && <div className="disc">{m.disclaimer}</div>}
            </div>
          ))}
        </div>

        <div className="notes">
          <div className="note">
            <div className="nt">How pricing works</div>
            Every plan starts with the <b>Base Platform</b> at {fmt(BASE_COST)}/yr (customer
            management, employee directory + management). Add any modules below at <b>{fmt(MODULE_COST)}/yr each</b>.
            Pay annually, or go <b>month-to-month for 10% more</b>. Add or remove modules anytime.
          </div>
          <div className="note">
            <div className="nt">Example</div>
            Base Platform plus <b>Billing</b> and <b>Service Scheduling</b>:
            {' '}{fmt(BASE_COST)} + {fmt(MODULE_COST)} + {fmt(MODULE_COST)} =
            {' '}<b>{fmt(BASE_COST + MODULE_COST * 2)}/yr</b> (or {fmtMo(BASE_COST + MODULE_COST * 2)}/mo
            {' '}month-to-month).
          </div>
        </div>

        <div className="foot">
          <div>Questions? Get started at <span className="cta">www.mybizapps.app</span></div>
          <div>Pricing subject to change · Effective June 2026</div>
        </div>
      </div>
    </div>
  )
}
