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
  const [googleLoading, setGoogleLoading] = useState(false)
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
    if (errorCode === 'auth_failed') {
      setError(
        'Google sign-in failed. Please try again, or use your email and password.'
      )
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

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Supabase bounces the user to Google, then back to this route with a
          // one-time code. Carry ?next= through so the deep link survives.
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPage
          )}`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
      // On success the browser is being redirected to Google — leave the
      // spinner up; this page is going away.
    } catch (err) {
      setError(err?.message || 'Could not start Google sign-in')
      setGoogleLoading(false)
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
          <img
            src="/images/mybizapps-logo.png"
            alt="MyBizApps"
            style={{ width: '200px', margin: '0 auto 24px', display: 'block' }}
          />
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
            disabled={loading || googleLoading}
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
            color: '#9bb0c4',
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1, height: 1, background: '#e0e6ec' }} />
          or
          <span style={{ flex: 1, height: 1, background: '#e0e6ec' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || googleLoading}
          style={{
            width: '100%',
            padding: 12,
            background: '#fff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: loading || googleLoading ? 'not-allowed' : 'pointer',
            opacity: loading || googleLoading ? 0.6 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}
