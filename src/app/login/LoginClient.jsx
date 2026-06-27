'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Clamp ?next= to a same-origin path to avoid open-redirects.
function safeNext(raw) {
  if (!raw || typeof raw !== 'string') return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPage = safeNext(searchParams.get('next'))
  const errorCode = searchParams.get('error')
  const errorEmail = searchParams.get('email')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Surface the "authenticated but not provisioned" case, and sign out so the
  // page doesn't bounce in a loop.
  useEffect(() => {
    if (errorCode === 'user_not_found') {
      setError(
        `You signed in successfully${errorEmail ? ` as ${errorEmail}` : ''}, but your ` +
          `account is not registered in MyBizApps. Contact your administrator.`
      )
      supabase.auth.signOut().catch(() => {})
      return
    }
    // Already signed in → skip the form.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(nextPage)
    })
  }, [errorCode, errorEmail, nextPage, router])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error
      // Full navigation so the destination's proxy sees the fresh auth cookies.
      window.location.replace(nextPage)
    } catch (err) {
      setError(err?.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 0',
    border: 'none',
    borderBottom: '2px solid #1a56a0',
    fontSize: 16,
    color: '#1a56a0',
    background: 'transparent',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: '#fff',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a56a0', margin: 0 }}>
            MyBizApps
          </h1>
          <p style={{ color: '#5580a0', fontSize: 14, marginTop: 8 }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: '#fde8e8',
              color: '#b02020',
              borderRadius: 4,
              marginBottom: 20,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              background: '#1a56a0',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
