import './marketing.css'

// Shared chrome for the public marketing surface — the brand mark/lockup, the
// sticky top nav, and the footer. Used by both the landing page
// (MarketingPage.jsx, served at "/") and the standalone /pricing page so the
// two never drift apart. Everything is scoped under `.mkt` (see marketing.css),
// which also full-bleeds out of the 480px app column from layout.js.

// Brand mark — a 4-quadrant squircle echoing "a family of apps":
// brand blue, bright blue, teal, warm orange.
export function BrandMark({ className = 'brand-mark' }) {
  return (
    <svg className={className} viewBox="0 0 44 44" role="img" aria-label="MyBizApps logo">
      <defs>
        <clipPath id="mb-squircle">
          <rect x="0" y="0" width="44" height="44" rx="11" />
        </clipPath>
      </defs>
      <g clipPath="url(#mb-squircle)">
        <rect x="0" y="0" width="22" height="22" fill="#3E8FD4" />
        <rect x="22" y="0" width="22" height="22" fill="#F08030" />
        <rect x="0" y="22" width="22" height="22" fill="#1a56a0" />
        <rect x="22" y="22" width="22" height="22" fill="#20A0B0" />
        <rect x="19.5" y="0" width="5" height="44" fill="#fff" />
        <rect x="0" y="19.5" width="44" height="5" fill="#fff" />
      </g>
    </svg>
  )
}

export function BrandLockup() {
  return (
    <a className="brand-lockup" href="/">
      <img src="/images/mybizapps-logo.png" alt="MyBizApps" style={{ height: '48px' }} />
    </a>
  )
}

// Sticky top nav. On the landing page (home=true) the section links are in-page
// anchors and Pricing scrolls to the inline #pricing section; on other pages
// (e.g. /pricing) they point back to the landing page and Pricing is the
// current route.
export function MarketingNav({ home = false }) {
  const base = home ? '' : '/'
  return (
    <nav className="top-nav">
      <div className="container top-nav-inner">
        <BrandLockup />
        <div className="nav-links">
          <a className="nav-link" href={`${base}#apps`}>Apps</a>
          <a className="nav-link" href={`${base}#why`}>Why MyBizApps</a>
          <a className="nav-link" href={home ? '#pricing' : '/pricing'}>Pricing</a>
          <a className="nav-link" href={`${base}#more`}>More apps</a>
        </div>
        <div className="nav-cta">
          <a className="btn btn-ghost" href="/login">Login</a>
          <a className="btn btn-primary" href="/signup">Get started</a>
        </div>
      </div>
    </nav>
  )
}

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="container foot-grid">
        <div>
          <BrandLockup />
          <p className="tagline">All-in-one operations<br />software for small business</p>
        </div>
        <div className="foot-col">
          <h6>Core apps</h6>
          <a href="/login">Customers CRM</a>
          <a href="/login">Invoices &amp; Quotes</a>
          <a href="/login">Accounting</a>
          <a href="/login">Service Schedule</a>
        </div>
        <div className="foot-col">
          <h6>More apps</h6>
          <a href="/login">Work Tickets</a>
          <a href="/login">Employee Directory</a>
          <a href="/login">On-Call Calendar</a>
          <a href="/login">Tasks &amp; Docs</a>
        </div>
        <div className="foot-col">
          <h6>Company</h6>
          <a href="/pricing">Pricing</a>
          <a href="/login">Log in</a>
          <a href="/signup">Get started</a>
          <a href="mailto:hello@mybizapps.app">Contact</a>
        </div>
      </div>
      <div className="container foot-bot">
        <span>© 2026 MyBizApps</span>
        <span>One login · Any device · Built for small business</span>
      </div>
    </footer>
  )
}
