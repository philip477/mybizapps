'use client'

import { useRouter } from 'next/navigation'

// Renders the right-side app icon, which may be an image URL or an emoji.
function HeaderAppIcon({ icon, title }) {
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'))
  if (isImageUrl) {
    return (
      <img
        src={icon}
        alt={title || ''}
        style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 4 }}
      />
    )
  }
  return <span style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
}

/**
 * PageHeader — top bar for every internal page.
 *
 * Props:
 *   title    — centered page/app name
 *   onBack   — optional override for the back button (defaults to router.back())
 *   appIcon  — optional app icon (image URL or emoji) shown on the far right;
 *              when omitted, a spacer keeps the title centered.
 *   onLogout — optional handler; when provided, a small "Log out" button is
 *              shown at the top-right (used where the home launcher's logout
 *              isn't reachable, e.g. the confined Master Control area).
 */
export default function PageHeader({ title, onBack, appIcon, onLogout }) {
  const router = useRouter()

  function handleBack() {
    if (typeof onBack === 'function') {
      onBack()
      return
    }
    router.back()
  }

  return (
    <div className="page-header">
      <button className="page-header__btn" onClick={handleBack} aria-label="Go back">
        <span style={{ fontSize: 24, lineHeight: 1, color: '#1a56a0' }}>‹</span>
      </button>

      <button
        className="page-header__btn page-header__home-btn"
        onClick={() => router.push('/')}
        aria-label="Home"
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>🏠</span>
      </button>

      <h1 className="page-header__title">{title}</h1>

      {/* Far-right: optional Log out button + app icon. A plain spacer keeps the
          title centered against the two left buttons when neither is supplied. */}
      {onLogout || appIcon ? (
        <div className="page-header__right">
          {onLogout && (
            <button type="button" className="page-header__logout" onClick={onLogout}>
              Log out
            </button>
          )}
          {appIcon && <HeaderAppIcon icon={appIcon} title={title} />}
        </div>
      ) : (
        <div className="page-header__spacer" />
      )}

      <style jsx>{`
        .page-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #ffffff;
          border-bottom: 2px solid #1a56a0;
          position: sticky;
          top: 0;
          z-index: 10;
          min-height: 54px;
        }
        .page-header__btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          transition: opacity 0.15s;
        }
        .page-header__btn:hover {
          opacity: 0.7;
        }
        .page-header__home-btn {
          padding: 6px 10px;
          background: #f5f8ff;
          border: 1.5px solid #d0e0f4;
          border-radius: 8px;
        }
        .page-header__title {
          flex: 1;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          color: #1a56a0;
          margin: 0;
          padding: 0 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-header__spacer {
          width: 76px;
          flex-shrink: 0;
        }
        .page-header__right {
          min-width: 76px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .page-header__logout {
          background: none;
          border: 1px solid #d0e0f4;
          border-radius: 4px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #5580a0;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
        }
        .page-header__logout:hover {
          background: #f5f8ff;
        }
      `}</style>
    </div>
  )
}
