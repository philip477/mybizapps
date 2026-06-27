import './marketing.css'

// MarketingPage — the public landing page shown at "/" to unauthenticated
// visitors. Self-contained (no external image assets): the brand mark is an
// inline SVG and every app glyph is an emoji on a tinted tile. The whole tree
// is scoped under `.mkt`, which also full-bleeds out of the 480px app column
// defined in layout.js so the marketing site renders edge-to-edge.

// Brand mark — a 4-quadrant squircle echoing "a family of apps":
// brand blue, bright blue, teal, warm orange.
function BrandMark({ className = 'brand-mark' }) {
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

function BrandLockup() {
  return (
    <a className="brand-lockup" href="/">
      <img src="/images/mybizapps-logo.png" alt="MyBizApps" style={{ height: '48px' }} />
    </a>
  )
}

// ── The flagship four + two supporting apps shown as full cards ──
const FLAGSHIP_APPS = [
  {
    icon: '👥', bg: '#EAF3FB',
    name: 'Customers CRM',
    desc: 'Every customer, contact, and job history in one searchable place — so the whole team knows who they are calling before the phone rings.',
  },
  {
    icon: '🧾', bg: '#FDF3E7',
    name: 'Invoices & Quotes',
    desc: 'Build a quote in the field, turn it into an invoice in a tap, and email it before you leave the driveway. Get paid faster.',
  },
  {
    icon: '📊', bg: '#E6F7F7',
    name: 'Accounting',
    desc: 'Track income and expenses as they happen. Categorize on the go, attach receipts, and see exactly where the money goes.',
  },
  {
    icon: '🗓️', bg: '#FDECEC',
    name: 'Service Schedule',
    desc: 'Dispatch the right tech to the right job at the right time. Recurring service calls, route order, and status — all in one board.',
  },
  {
    icon: '🎟️', bg: '#FDF3E7',
    name: 'Work Tickets',
    desc: 'A request comes in, someone snaps a photo and taps send. The right team gets it instantly — and you keep the history forever.',
  },
  {
    icon: '📇', bg: '#EAF3FB',
    name: 'Employee Directory',
    desc: 'Who works here, in what role, how to reach them, and which groups they belong to. Drives access across every other app.',
  },
]

// ── Supporting apps shown as compact chips ──
const SUPPORTING_APPS = [
  { icon: '📅', bg: '#EAF3FB', name: 'Meetings & Reservations', tag: 'Book rooms, log sign-ins' },
  { icon: '📞', bg: '#E6F7F7', name: 'On-Call Calendar', tag: "Know who's covering, always" },
  { icon: '🔔', bg: '#FDF3E7', name: 'Alerts', tag: 'Reach the whole team at once' },
  { icon: '👬', bg: '#FDECEC', name: 'Groups', tag: 'Departments & permissions' },
  { icon: '✅', bg: '#EAF3FB', name: 'Tasks', tag: 'Checklists for every shift' },
  { icon: '📄', bg: '#E6F7F7', name: 'Docs', tag: 'Forms, policies & files' },
  { icon: '🛠️', bg: '#FDF3E7', name: 'Service Calls', tag: 'Field-ready job records' },
  { icon: '⚙️', bg: '#F5F7FA', name: 'Business Admin', tag: 'Configure your apps' },
]

// Rows for the hero phone mock — mirrors the real app launcher. Every row has
// an icon + tile color; some also carry live "badge" counts.
const HERO_ROWS = [
  { label: 'Customers', icon: '👥', bg: '#EAF3FB' },
  { label: 'Invoices & Quotes', icon: '🧾', bg: '#FDF3E7', badges: [{ e: '🧾', n: 4 }, { e: '✉️', n: 2 }] },
  { label: 'Accounting', icon: '📊', bg: '#E6F7F7' },
  { label: 'Service Schedule', icon: '🗓️', bg: '#FDECEC', badges: [{ e: '📅', n: 6 }, { e: '📍', n: 4 }] },
  { label: 'Work Tickets', icon: '🎟️', bg: '#FDF3E7', badges: [{ e: '🔧', n: 3 }, { e: '🎫', n: 5 }] },
  { label: 'Employee Directory', icon: '📇', bg: '#EAF3FB' },
  { label: 'Alerts', icon: '🔔', bg: '#E6F7F7', badges: [{ e: '🔔', n: 2 }] },
  { label: 'My Tasks', icon: '✅', bg: '#FDECEC', badges: [{ e: '📋', n: 7 }] },
]

function PhoneRow({ row }) {
  return (
    <li className="phone-row">
      <div className="icon-box" style={row.bg ? { background: row.bg } : undefined}>
        <span aria-hidden="true">{row.icon}</span>
      </div>
      <div className="label">{row.label}</div>
      {row.badges?.length ? (
        <div className="badges" aria-hidden="true">
          {row.badges.map((b, bi) => (
            <span className="badge-emoji" key={bi}>
              {b.e}{b.n != null && <span className="n">{b.n}</span>}
            </span>
          ))}
        </div>
      ) : null}
      <span className="chev" aria-hidden="true">›</span>
    </li>
  )
}

function PhoneMock({ rows, mini = false, user = 'Dana', version = '1.0' }) {
  return (
    <div className={mini ? 'mini-phone' : 'phone'}>
      <div className="phone-screen">
        <div className="phone-header">
          <BrandMark />
          <div className="name"><span className="b">MyBiz</span><span className="t">Apps</span></div>
          <div className="ver">
            <div>vs {version}</div>
            <div>{user}</div>
          </div>
        </div>
        <ul className="phone-list">
          {rows.map((r, i) => <PhoneRow row={r} key={i} />)}
        </ul>
      </div>
    </div>
  )
}

export default function MarketingPage() {
  return (
    <div className="mkt">
      {/* ── Top nav ── */}
      <nav className="top-nav">
        <div className="container top-nav-inner">
          <BrandLockup />
          <div className="nav-links">
            <a className="nav-link" href="#apps">Apps</a>
            <a className="nav-link" href="#why">Why MyBizApps</a>
            <a className="nav-link" href="#more">More apps</a>
          </div>
          <div className="nav-cta">
            <a className="btn btn-ghost" href="/login">Login</a>
            <a className="btn btn-primary" href="/login">Get started</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <img src="/images/mybizapps-logo.png" alt="MyBizApps" style={{ height: '96px', marginBottom: '20px' }} />
            <div className="eyebrow">All-in-one software for small business</div>
            <h1>
              The apps your<br />
              business actually<br />
              <em>needs.</em> One login.
            </h1>
            <p className="lede">
              MyBizApps is a purpose-built suite for service companies, contractors, and
              small offices. Customers, quotes, invoices, accounting, scheduling, and your
              whole team — in one simple, mobile-first menu.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="/login">Get started free</a>
              <a className="btn btn-outline btn-lg" href="#apps">See the apps</a>
            </div>
            <div className="hero-bullets">
              <div className="b"><span className="check-dot">✓</span> Works on any phone</div>
              <div className="b"><span className="check-dot">✓</span> No setup fees</div>
              <div className="b"><span className="check-dot">✓</span> Up and running in days</div>
            </div>
          </div>
          <div className="phone-wrap">
            <PhoneMock rows={HERO_ROWS} user="Dana" version="1.0" />
            <div className="callout callout-1">
              <div className="kicker">One menu</div>
              <div className="line">Every app your team touches, in one phone-width launcher.</div>
              <span className="arm" />
            </div>
            <div className="callout callout-2">
              <div className="kicker">Live badges</div>
              <div className="line">Open invoices, scheduled jobs, unread alerts — at a glance.</div>
              <span className="arm" />
            </div>
            <div className="callout callout-3">
              <div className="kicker">Quote to cash</div>
              <div className="line">Quote in the field, invoice in a tap, get paid faster.</div>
              <span className="arm" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Flagship apps ── */}
      <section className="section sunken" id="apps">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">The core apps</div>
            <h2>The apps that run the business.</h2>
            <p>
              Everyone signs into the same simple menu. Your team learns one thing, and you
              switch on the rest as you grow.
            </p>
          </div>
          <div className="app-grid">
            {FLAGSHIP_APPS.map((a) => (
              <a className="app-card" href="/login" key={a.name}>
                <div className="app-icon" style={{ background: a.bg }}>
                  <span aria-hidden="true">{a.icon}</span>
                </div>
                <div className="app-name">{a.name}</div>
                <div className="app-desc">{a.desc}</div>
                <div className="app-foot">Learn more →</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why MyBizApps (feature stripes) ── */}
      <section className="section" id="why">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Why owners switch</div>
            <h2>Built for the people doing the work.</h2>
            <p>
              Every decision defers to the tech in the truck and the office manager at the
              front desk. If it takes more than a few taps, we redesigned it.
            </p>
          </div>

          <div className="stripe">
            <div className="stripe-copy">
              <div className="eyebrow">Customers &amp; jobs</div>
              <h3>Know every customer before you knock.</h3>
              <p>
                The Customers CRM keeps every contact, address, and past job in one place.
                Pull up a customer's full history on your phone — what you did last time,
                what they owe, and what comes next.
              </p>
              <ul>
                <li><span className="check-dot">✓</span> Full job &amp; service history per customer</li>
                <li><span className="check-dot">✓</span> Notes, addresses, and contacts in one card</li>
                <li><span className="check-dot">✓</span> Links straight to quotes, invoices, and schedule</li>
              </ul>
              <a className="stripe-link" href="/login">Open Customers →</a>
            </div>
            <div className="stripe-visual">
              <PhoneMock mini rows={[
                { label: 'Customers', icon: '👥', bg: '#EAF3FB' },
                { label: 'Acme Plumbing Co.', icon: '🏢', bg: '#E6F7F7' },
                { label: 'Open Invoices', icon: '🧾', bg: '#FDF3E7', badges: [{ e: '💲', n: 2 }] },
                { label: 'Scheduled Jobs', icon: '🗓️', bg: '#FDECEC', badges: [{ e: '📍', n: 3 }] },
                { label: 'Job History', icon: '🗂️', bg: '#F5F7FA' },
              ]} />
            </div>
          </div>

          <div className="stripe flip">
            <div className="stripe-copy">
              <div className="eyebrow">Quote → invoice → paid</div>
              <h3>Turn a quote into cash without the paperwork.</h3>
              <p>
                Write a quote on site, convert it to an invoice in one tap, and email it
                before you pull away. Accounting picks up the income automatically, so the
                books stay current without a second app.
              </p>
              <ul>
                <li><span className="check-dot">✓</span> Quotes convert to invoices in a tap</li>
                <li><span className="check-dot">✓</span> Email invoices straight from your phone</li>
                <li><span className="check-dot">✓</span> Income flows into Accounting automatically</li>
              </ul>
              <a className="stripe-link" href="/login">Open Invoices &amp; Quotes →</a>
            </div>
            <div className="stripe-visual">
              <PhoneMock mini rows={[
                { label: 'New Quote', icon: '📝', bg: '#EAF3FB' },
                { label: 'Convert to Invoice', icon: '🧾', bg: '#FDF3E7' },
                { label: 'Email to Customer', icon: '✉️', bg: '#E6F7F7' },
                { label: 'Mark Paid', icon: '💳', bg: '#EAF3FB' },
                { label: 'Income Recorded', icon: '📊', bg: '#FDECEC' },
              ]} />
            </div>
          </div>

          <div className="stripe">
            <div className="stripe-copy">
              <div className="eyebrow">Scheduling &amp; dispatch</div>
              <h3>The right tech, the right job, the right time.</h3>
              <p>
                The Service Schedule board shows the whole week at a glance. Dispatch jobs,
                set up recurring service, and keep the field and the office looking at the
                same plan — no more double-booked trucks.
              </p>
              <ul>
                <li><span className="check-dot">✓</span> Recurring service calls on autopilot</li>
                <li><span className="check-dot">✓</span> Assign and re-route jobs in seconds</li>
                <li><span className="check-dot">✓</span> On-Call Calendar keeps coverage clear</li>
              </ul>
              <a className="stripe-link" href="/login">Open Service Schedule →</a>
            </div>
            <div className="stripe-visual">
              <PhoneMock mini rows={[
                { label: 'Service Schedule', icon: '🗓️', bg: '#FDECEC', badges: [{ e: '📅', n: 6 }] },
                { label: "Today's Route", icon: '🚚', bg: '#EAF3FB', badges: [{ e: '📍', n: 4 }] },
                { label: 'Recurring Service', icon: '🔁', bg: '#E6F7F7' },
                { label: 'On-Call Calendar', icon: '📞', bg: '#FDF3E7' },
                { label: 'Work Tickets', icon: '🎟️', bg: '#FDF3E7', badges: [{ e: '🔧', n: 3 }] },
              ]} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Supporting apps ── */}
      <section className="section sunken" id="more">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">The rest of the suite</div>
            <h2>Everything else your operation runs on.</h2>
            <p>Switch on what you need, when you need it. It all lives behind the same login.</p>
          </div>
          <div className="chip-grid">
            {SUPPORTING_APPS.map((a) => (
              <div className="chip" key={a.name}>
                <div className="chip-icon" style={{ background: a.bg }}>
                  <span aria-hidden="true">{a.icon}</span>
                </div>
                <div>
                  <div className="chip-name">{a.name}</div>
                  <div className="chip-tag">{a.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stat band ── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="stat-row">
            <div className="stat"><div className="n">12+</div><div className="l">Apps, one login</div></div>
            <div className="stat"><div className="n">1</div><div className="l">Menu to learn</div></div>
            <div className="stat"><div className="n">&lt;1 wk</div><div className="l">To get running</div></div>
            <div className="stat"><div className="n">24/7</div><div className="l">On any device</div></div>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="cta-band">
        <div className="container cta-inner">
          <div className="eyebrow">Get started</div>
          <h2>Run your whole business from your pocket.</h2>
          <p>
            Bring your customers, quotes, invoices, accounting, and schedule under one
            simple login. Start today, or have us walk your team through it.
          </p>
          <div className="cta-actions">
            <a className="btn btn-white btn-lg" href="/login">Get started free</a>
            <a className="btn btn-ghost-light btn-lg" href="mailto:hello@mybizapps.app?subject=MyBizApps%20demo%20request">Request a demo</a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
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
            <a href="/login">Log in</a>
            <a href="/login">Get started</a>
            <a href="mailto:hello@mybizapps.app">Contact</a>
          </div>
        </div>
        <div className="container foot-bot">
          <span>© 2026 MyBizApps</span>
          <span>One login · Any device · Built for small business</span>
        </div>
      </footer>
    </div>
  )
}
