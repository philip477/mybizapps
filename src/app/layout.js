import './globals.css'

export const metadata = {
  title: 'MyBizApps',
  description: 'MyBizApps — multi-tenant business operations platform',
  metadataBase: new URL('https://mybizapps.app'),
  applicationName: 'MyBizApps',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MyBizApps',
  },
}

// Lock the viewport to device width so the 480px-max column centers correctly
// on tablets / large phones instead of being double-scaled. PWA-ready.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a56a0',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <div
          style={{
            maxWidth: '480px',
            minHeight: '100vh',
            margin: '0 auto',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {children}
        </div>
      </body>
    </html>
  )
}
