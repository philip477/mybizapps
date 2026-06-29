'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const NAV = '#1a56a0'
const MUTED = '#5580a0'
const BORDER = '#d0e0f4'
const GREEN = '#1a7a42'
const GOLD = '#8a6d00'

export default function AcceptPaymentsClient({ initialStatus = null }) {
  const router = useRouter()
  const status = initialStatus || { connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false }
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function startOnboarding() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST', credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.url) {
        window.location.href = body.url // hosted Stripe onboarding
        return
      }
      setError(body.error || `Error ${res.status}`)
      setStarting(false)
    } catch (e) {
      setError(e.message || 'Could not start onboarding')
      setStarting(false)
    }
  }

  const ready = status.charges_enabled
  const inProgress = status.connected && !status.charges_enabled

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <PageHeader title="Accept Card Payments" onBack={() => router.push('/business-admin-apps')} />

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          Connect your company&apos;s Stripe account to accept credit and debit card payments.
          Money goes directly to your bank at Stripe&apos;s standard rates — there&apos;s no monthly fee.
        </div>

        <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 16, background: '#f5f8ff' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            Status
          </div>
          {ready ? (
            <div style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>✓ Connected — ready to accept payments</div>
          ) : inProgress ? (
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>⏳ Setup started — more info needed</div>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 800, color: NAV }}>Not set up yet</div>
          )}
          {status.connected && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
              Payments: {status.charges_enabled ? 'enabled' : 'pending'} · Payouts: {status.payouts_enabled ? 'enabled' : 'pending'} · Details: {status.details_submitted ? 'submitted' : 'incomplete'}
            </div>
          )}
        </div>

        <button
          onClick={startOnboarding}
          disabled={starting}
          style={{
            width: '100%', padding: '14px', background: starting ? '#c0cce0' : NAV, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 800,
            cursor: starting ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {starting ? 'Opening Stripe…' : ready ? 'Manage / update payment details' : inProgress ? 'Continue setup' : 'Set up card payments'}
        </button>

        <div style={{ fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
          You&apos;ll be taken to Stripe to verify your business, add a bank account, and confirm a
          responsible person. It takes a few minutes — you can come back here anytime to check status.
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: '#fde8e8', color: '#b02020', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
