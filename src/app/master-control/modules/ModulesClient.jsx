'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

// Base Platform yearly price — mirrors BASE_COST on the public /price-sheet.
const BASE_YEARLY = 1000
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US')
// Month-to-month: annual ÷ 12 + 10% (matches fmtMo on /price-sheet).
const perMonth = (n) =>
  '$' + Math.round((Number(n || 0) / 12) * 1.1).toLocaleString('en-US')

export default function ModulesClient({ initialModules = [] }) {
  const router = useRouter()
  const base = initialModules.filter((m) => m.is_base)
  const addons = initialModules.filter((m) => !m.is_base)

  function card(m) {
    return (
      <button
        key={m.id}
        className="row"
        onClick={() => router.push(`/master-control/modules/${m.id}`)}
      >
        <span className="ic">{m.icon || '📦'}</span>
        <div className="main">
          <div className="name">
            {m.name}
            {!m.active && <span className="badge">Inactive</span>}
          </div>
          {m.description && <div className="desc">{m.description}</div>}
        </div>
        <div className="price">
          {m.is_base ? (
            <span className="incl">Included ✓</span>
          ) : (
            <>
              <span className="yr">{money(m.price_yearly)}/yr</span>
              <span className="mo">{perMonth(m.price_yearly)}/mo</span>
            </>
          )}
        </div>
        <span className="chev">›</span>
      </button>
    )
  }

  return (
    <div className="wrap">
      <PageHeader title="Modules" />

      <div className="banner">
        <span className="b-ic">⚙️</span>
        <div className="b-main">
          <div className="b-name">Base Platform</div>
          <div className="b-desc">Includes the core modules below</div>
        </div>
        <div className="b-price">
          <span className="yr">{money(BASE_YEARLY)}/yr</span>
          <span className="mo">{perMonth(BASE_YEARLY)}/mo</span>
        </div>
      </div>

      <div className="sec">✅ Included in the Base Platform</div>
      <div className="list">
        {base.length ? base.map(card) : <div className="empty">No base modules yet</div>}
      </div>

      <div className="sec">🧩 Add-On Modules</div>
      <div className="list">
        {addons.length ? addons.map(card) : <div className="empty">No add-on modules yet</div>}
      </div>

      <div className="footer">
        <button
          className="add-btn"
          onClick={() => router.push('/master-control/modules/new')}
        >
          + Add Module
        </button>
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
        }
        .banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          background: #f5f8ff;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .b-ic {
          font-size: 26px;
        }
        .b-main {
          flex: 1;
          min-width: 0;
        }
        .b-name {
          font-size: 15px;
          font-weight: 700;
          color: ${C};
        }
        .b-desc {
          font-size: 12px;
          color: ${C_MUTED};
        }
        .b-price {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
        }
        .b-price .yr {
          font-size: 15px;
          font-weight: 700;
          color: ${C};
        }
        .b-price .mo {
          font-size: 12px;
          color: ${C_MUTED};
        }
        .sec {
          padding: 14px 12px 6px;
          font-size: 13px;
          font-weight: 700;
          color: ${C};
        }
        .list {
          display: flex;
          flex-direction: column;
        }
        .row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #fff;
          border: none;
          border-bottom: 1.5px solid ${C_BORDER};
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .row:hover {
          background: #f5f8ff;
        }
        .ic {
          font-size: 22px;
          flex-shrink: 0;
        }
        .main {
          flex: 1;
          min-width: 0;
        }
        .name {
          font-size: 15px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #b02020;
          background: #fde8e8;
          border-radius: 4px;
          padding: 1px 6px;
        }
        .desc {
          font-size: 13px;
          color: ${C_MUTED};
        }
        .price {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          flex-shrink: 0;
        }
        .price .yr {
          font-size: 14px;
          font-weight: 700;
          color: ${C};
        }
        .price .mo {
          font-size: 12px;
          color: ${C_MUTED};
        }
        .incl {
          font-size: 13px;
          font-weight: 600;
          color: #1a8a3a;
        }
        .chev {
          font-size: 22px;
          color: ${C_BORDER};
          flex-shrink: 0;
        }
        .empty {
          padding: 24px 12px;
          text-align: center;
          color: ${C_MUTED};
          font-size: 14px;
        }
        .footer {
          position: sticky;
          bottom: 0;
          padding: 12px;
          background: #fff;
          border-top: 1.5px solid ${C_BORDER};
          margin-top: 8px;
        }
        .add-btn {
          width: 100%;
          background: ${C};
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 14px 0;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
      `}</style>
    </div>
  )
}
