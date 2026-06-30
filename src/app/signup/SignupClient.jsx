'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// SignupClient — self-serve account creation. Creates the Supabase auth user,
// then provisions a brand-new facility (company), a super_user profile, and the
// default set of apps via /api/signup/provision. On success the user is signed
// in and dropped straight onto the app home.
export default function SignupClient() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Already signed in → no reason to be on signup; send them home.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) window.location.replace('/')
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (!company.trim()) {
      setError('Please enter your company name.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      // 1. Create the auth user. emailRedirectTo brings a confirmation link
      //    (if the project requires one) back to the app.
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
        },
      })
      if (signUpErr) throw signUpErr

      // Supabase returns a user with no identities when the email is already
      // registered (it avoids leaking that fact via an error).
      if (signUpData?.user && (signUpData.user.identities?.length ?? 0) === 0) {
        throw new Error('An account with this email already exists. Try signing in instead.')
      }

      // 2. Ensure we have a live session before provisioning (covers projects
      //    with email auto-confirm; signUp already returns a session there).
      if (!signUpData?.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (signInErr) {
          // Most likely the project requires email confirmation.
          setError(
            'Account created! Please check your email to confirm your address, then sign in.'
          )
          setLoading(false)
          return
        }
      }

      // 3. Provision the facility, profile, and apps (server-side, SECURITY
      //    DEFINER) — auth id + email are read from the verified session there.
      const res = await fetch('/api/signup/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company_name: company.trim(),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not finish setting up your account.')
      }

      // 4. Remember the facility so the app knows which tenant this user is in.
      if (payload?.facility_id) {
        try {
          localStorage.setItem('biz_facility_id', payload.facility_id)
        } catch {
          // Private mode / storage disabled — non-fatal.
        }
      }

      // 5. Full navigation so the home route's proxy sees the fresh auth cookies.
      window.location.replace('/')
    } catch (err) {
      setError(err?.message || 'Could not create your account. Please try again.')
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
          <img
            src="/images/mybizapps-logo.png"
            alt="MyBizApps"
            style={{ width: '200px', margin: '0 auto 24px', display: 'block' }}
          />
          <p style={{ color: '#5580a0', fontSize: 14, marginTop: 8 }}>
            Create your account
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
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
              autoComplete="given-name"
              style={inputStyle}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              required
              autoComplete="family-name"
              style={inputStyle}
            />
          </div>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company name"
            required
            autoComplete="organization"
            style={inputStyle}
          />
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
            autoComplete="new-password"
            style={inputStyle}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            required
            autoComplete="new-password"
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: 24,
            fontSize: 14,
            color: '#5580a0',
          }}
        >
          Already have an account?{' '}
          <a href="/login" style={{ color: '#1a56a0', fontWeight: 600 }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
