'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'
const GREEN = '#1a7a42'
const RED = '#b02020'

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('T')[0].split('-')
  return `${m}/${day}/${y}`
}

// Current year-month key, e.g. "2026-06".
function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function inCurrentMonth(dateStr, key) {
  if (!dateStr) return false
  return dateStr.slice(0, 7) === key
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card" style={{ borderColor: color }}>
      <div className="card-label">{label}</div>
      <div className="card-value" style={{ color }}>
        {value}
      </div>
      <style jsx>{`
        .card {
          flex: 1;
          min-width: 0;
          border: 1.5px solid ${C_BORDER};
          border-radius: 10px;
          padding: 12px 8px;
          text-align: center;
          background: #fff;
        }
        .card-label {
          font-size: 11px;
          font-weight: 600;
          color: ${C_MUTED};
          margin-bottom: 6px;
          white-space: nowrap;
        }
        .card-value {
          font-size: 17px;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}

export default function AccountingClient({ expenses = [], income = [] }) {
  const router = useRouter()
  const [tab, setTab] = useState('expenses') // 'expenses' | 'income'

  const monthKey = currentMonthKey()

  const totals = useMemo(() => {
    const inc = income
      .filter((r) => inCurrentMonth(r.income_date, monthKey))
      .reduce((s, r) => s + Number(r.amount || 0), 0)
    const exp = expenses
      .filter((r) => inCurrentMonth(r.expense_date, monthKey))
      .reduce((s, r) => s + Number(r.amount || 0), 0)
    return { inc, exp, net: inc - exp }
  }, [income, expenses, monthKey])

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    []
  )

  return (
    <div className="wrap">
      <PageHeader title="Accounting" />

      {/* Summary cards */}
      <div className="summary">
        <div className="summary-title">{monthLabel}</div>
        <div className="cards">
          <SummaryCard label="Income" value={money(totals.inc)} color={GREEN} />
          <SummaryCard label="Expenses" value={money(totals.exp)} color={RED} />
          <SummaryCard label="Net" value={money(totals.net)} color={C} />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'expenses', label: 'Expenses' },
          { key: 'income', label: 'Income' },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="list">
        {tab === 'expenses' ? (
          expenses.length === 0 ? (
            <div className="empty">No expenses yet</div>
          ) : (
            expenses.map((r) => (
              <button
                key={r.id}
                className="row"
                onClick={() => router.push(`/accounting/expense/${r.id}`)}
              >
                <div className="row-main">
                  <div className="row-name">{r.description || '(no description)'}</div>
                  <div className="row-sub">
                    {fmtDate(r.expense_date)}
                    {r.biz_expense_categories?.name ? ` · ${r.biz_expense_categories.name}` : ''}
                    {r.vendor ? ` · ${r.vendor}` : ''}
                  </div>
                </div>
                <div className="row-amt" style={{ color: RED }}>
                  -{money(r.amount)}
                </div>
              </button>
            ))
          )
        ) : income.length === 0 ? (
          <div className="empty">No income yet</div>
        ) : (
          income.map((r) => (
            <button
              key={r.id}
              className="row"
              onClick={() => router.push(`/accounting/income/${r.id}`)}
            >
              <div className="row-main">
                <div className="row-name">{r.description || '(no description)'}</div>
                <div className="row-sub">
                  {fmtDate(r.income_date)}
                  {r.source ? ` · ${r.source}` : ''}
                </div>
              </div>
              <div className="row-amt" style={{ color: GREEN }}>
                +{money(r.amount)}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer add buttons */}
      <div className="footer">
        {tab === 'expenses' ? (
          <button className="add-btn" onClick={() => router.push('/accounting/expense/new')}>
            + Add Expense
          </button>
        ) : (
          <button className="add-btn" onClick={() => router.push('/accounting/income/new')}>
            + Add Income
          </button>
        )}
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
        }
        .summary {
          padding: 12px;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .summary-title {
          font-size: 13px;
          font-weight: 600;
          color: ${C_MUTED};
          margin-bottom: 8px;
        }
        .cards {
          display: flex;
          gap: 8px;
        }
        .tabs {
          display: flex;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .tab {
          flex: 1;
          padding: 12px 0;
          background: #fff;
          border: none;
          border-bottom: 2.5px solid transparent;
          font-size: 14px;
          font-weight: 600;
          color: ${C_MUTED};
          cursor: pointer;
          font-family: inherit;
        }
        .tab--active {
          color: ${C};
          border-bottom-color: ${C};
          background: #f5f8ff;
        }
        .list {
          flex: 1;
        }
        .row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 12px;
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
        .row-main {
          flex: 1;
          min-width: 0;
        }
        .row-name {
          font-size: 15px;
          font-weight: 600;
          color: ${C};
          margin-bottom: 2px;
        }
        .row-sub {
          font-size: 13px;
          color: ${C_MUTED};
        }
        .row-amt {
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .empty {
          padding: 48px 12px;
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
