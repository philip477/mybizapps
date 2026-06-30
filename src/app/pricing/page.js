import { MarketingNav, MarketingFooter } from '../marketing-shared'
import PricingSection, { ADDON_PRICE } from '../PricingSection'

// Standalone /pricing — the marketing pricing page, linkable directly. Public:
// "/pricing" is allowlisted in proxy.js so unauthenticated visitors reach it.
// Reuses the marketing chrome (nav/footer) and the shared PricingSection so it
// stays in sync with the inline pricing block on the landing page.
export const metadata = {
  title: 'MyBizApps — Pricing',
  description:
    'Simple pricing for MyBizApps: start free with the core apps, add premium modules at $250/year each.',
}

export default function PricingPage() {
  return (
    <div className="mkt">
      <MarketingNav />

      {/* ── Compact hero ── */}
      <section className="pricing-hero">
        <div className="container">
          <div className="eyebrow">Pricing</div>
          <h1>One simple price. Add what you need.</h1>
          <p className="lede">
            Start with the core apps that run your business, then switch on premium
            add-ons at ${ADDON_PRICE}/year each. No setup fees, no long-term contract —
            add or remove modules anytime.
          </p>
        </div>
      </section>

      <PricingSection />

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
            <a className="btn btn-white btn-lg" href="/signup">Get Started</a>
            <a className="btn btn-ghost-light btn-lg" href="mailto:hello@mybizapps.app?subject=MyBizApps%20demo%20request">Request a demo</a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
