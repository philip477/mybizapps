// PricingSection — the two-tier pricing block shared by the marketing landing
// page (rendered inline as #pricing) and the standalone /pricing route. Scoped
// under `.mkt`, so it inherits the marketing styles in marketing.css.
//
// The numbers and copy mirror the `biz_modules` catalog in Supabase (base
// platform at $1,000/yr, premium add-ons at $250/yr each). biz_modules is
// RLS-scoped to authenticated, facility-bound users, so a public page can't read
// it with the anon key — like /price-sheet, the marketing copy is kept in sync
// here by hand.

// Base modules — included with every account.
export const BASE_MODULES = [
  {
    icon: '👥', bg: '#EAF3FB',
    name: 'Customer Management',
    desc: 'Every customer, contact, and job history in one searchable place.',
  },
  {
    icon: '📇', bg: '#EAF3FB',
    name: 'Employee Directory',
    desc: 'Who works here, their role, and how to reach them.',
  },
  {
    icon: '📈', bg: '#E6F7F7',
    name: 'Management',
    desc: 'Dashboards and reporting for owners and managers.',
  },
]

// Premium add-on modules — $250/year each, switch on as you grow.
export const ADDON_MODULES = [
  {
    icon: '🧾', bg: '#FDF3E7',
    name: 'Billing Module',
    desc: 'Build and email quotes and invoices, and track payments.',
  },
  {
    icon: '🗓️', bg: '#FDECEC',
    name: 'Service Scheduling',
    desc: 'Dispatch jobs and recurring service; sync field and office.',
  },
  {
    icon: '🔑', bg: '#EAF3FB',
    name: 'Customer Portal',
    desc: 'Customers view invoices, requests, and updates online.',
  },
  {
    icon: '🌐', bg: '#E6F7F7',
    name: 'Informational Website',
    desc: 'A simple public website, kept in sync with your apps.',
  },
  {
    icon: '📦', bg: '#FDF3E7',
    name: 'Manage Assets',
    desc: 'Track equipment and tools with maintenance history.',
  },
  {
    icon: '🤖', bg: '#FDECEC',
    name: 'AI Office Helpers',
    desc: 'AI that drafts, summarizes, and automates office work.',
  },
  {
    icon: '📊', bg: '#E6F7F7',
    name: 'Accounting',
    desc: 'Track income and expenses; see where the money goes.',
  },
]

export const BASE_PRICE = 1000
export const ADDON_PRICE = 250

export default function PricingSection({ sunken = true }) {
  return (
    <section className={`section pricing${sunken ? ' sunken' : ''}`} id="pricing">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Pricing</div>
          <h2>Start with the essentials. Add what you need.</h2>
          <p>
            Every account comes with the core apps that run the business. Switch on
            premium add-ons at ${ADDON_PRICE}/year each — add or remove them anytime.
          </p>
        </div>

        <div className="pricing-grid">
          {/* ── Starter (featured) ── */}
          <div className="price-card featured">
            <div className="price-card-head">
              <div className="plan-name">Starter</div>
              <div className="plan-price">
                <span className="amt">${BASE_PRICE.toLocaleString('en-US')}</span>
                <span className="per">/ year</span>
              </div>
              <p className="plan-blurb">
                The core apps every business needs to get running on day one.
              </p>
              <a className="btn btn-white btn-lg price-cta" href="/signup">Get Started</a>
            </div>
            <div className="price-includes">Includes</div>
            <ul className="price-modules">
              {BASE_MODULES.map((m) => (
                <li className="price-module" key={m.name}>
                  <div className="pm-icon" style={{ background: m.bg }}>
                    <span aria-hidden="true">{m.icon}</span>
                  </div>
                  <div className="pm-body">
                    <div className="pm-name">{m.name}</div>
                    <div className="pm-desc">{m.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Premium add-ons ── */}
          <div className="price-card">
            <div className="price-card-head">
              <div className="plan-name">Premium Add-ons</div>
              <div className="plan-price">
                <span className="amt">${ADDON_PRICE}</span>
                <span className="per">/ year each</span>
              </div>
              <p className="plan-blurb">
                Build the platform your business needs — turn on only the modules you use.
              </p>
              <a className="btn btn-primary btn-lg price-cta" href="/signup">Get Started</a>
            </div>
            <div className="price-includes">Available modules</div>
            <div className="addon-grid">
              {ADDON_MODULES.map((m) => (
                <div className="addon-item" key={m.name}>
                  <div className="pm-icon" style={{ background: m.bg }}>
                    <span aria-hidden="true">{m.icon}</span>
                  </div>
                  <div className="pm-body">
                    <div className="pm-name">{m.name}</div>
                    <div className="pm-desc">{m.desc}</div>
                  </div>
                  <div className="addon-price">${ADDON_PRICE}<span>/yr</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
