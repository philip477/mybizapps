import { Suspense } from 'react'
import SignupClient from './SignupClient'

// /signup — self-serve account creation. Public route (excluded from the proxy's
// auth matcher, same as /login). Wrapped in Suspense to match the login page.
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1a56a0',
            fontSize: 18,
          }}
        >
          Loading...
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  )
}
