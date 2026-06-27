import { Suspense } from 'react'
import LoginClient from './LoginClient'

// Wrap in Suspense because LoginClient reads useSearchParams (?next=, ?error=).
export default function LoginPage() {
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
      <LoginClient />
    </Suspense>
  )
}
