// Lazy Stripe client. The SDK is only instantiated on first use so that builds
// (and unrelated routes) never fail when STRIPE_SECRET_KEY isn't configured —
// the error surfaces only when a payment/Connect route is actually hit.
//
// Set STRIPE_SECRET_KEY in the environment (Vercel project env vars / .env.local)
// to a Stripe secret key from a platform account with Connect enabled.
import Stripe from 'stripe'

let _stripe = null

function getStripe() {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Add it to your environment to enable payments.')
  }
  _stripe = new Stripe(key)
  return _stripe
}

// Proxy so callers can use `stripe.accounts.create(...)` etc. without each route
// having to guard initialization.
export const stripe = new Proxy({}, {
  get(_target, prop) {
    const client = getStripe()
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
