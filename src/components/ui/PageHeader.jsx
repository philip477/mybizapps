'use client'

import { useRouter } from 'next/navigation'

/**
 * PageHeader — top bar for every internal page.
 *
 * Props:
 *   title  — centered page/app name
 *   onBack — optional override for the back button (defaults to router.back())
 */
export default function PageHeader({ title, onBack }) {
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

      {/* Spacer keeps the title centered against the two left buttons. */}
      <div className="page-header__spacer" />

      <style jsx>{`
        .page-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
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
      `}</style>
    </div>
  )
}
