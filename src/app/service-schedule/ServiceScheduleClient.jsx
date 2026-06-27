'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

const C = '#1a56a0'
const C_MUTED = '#5580a0'
const C_BORDER = '#d0e0f4'

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: '#1a56a0' },
  en_route: { label: 'En Route', color: '#d6a400' },
  in_progress: { label: 'In Progress', color: '#e06d1f' },
  completed: { label: 'Completed', color: '#1a7a42' },
  cancelled: { label: 'Cancelled', color: '#8a8a8a' },
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function customerName(call) {
  const c = call.biz_customers
  if (!c) return 'No customer'
  if (c.company_name) return c.company_name
  const person = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  return person || 'No customer'
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('T')[0].split('-')
  return `${m}/${day}/${y}`
}

// Local YYYY-MM-DD for a Date.
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function StatusDot({ status }) {
  const s = STATUS_META[status] || STATUS_META.scheduled
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: s.color,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
    </span>
  )
}

export default function ServiceScheduleClient({ initialCalls = [] }) {
  const router = useRouter()
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [weekOffset, setWeekOffset] = useState(0)

  // The 7 days of the displayed week (starting Sunday), shifted by weekOffset.
  const weekDays = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    start.setDate(start.getDate() - start.getDay() + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [weekOffset])

  const callsByDate = useMemo(() => {
    const map = {}
    for (const call of initialCalls) {
      const key = (call.scheduled_date || '').split('T')[0]
      if (!key) continue
      ;(map[key] = map[key] || []).push(call)
    }
    return map
  }, [initialCalls])

  const todayKey = dateKey(new Date())

  return (
    <div className="wrap">
      <PageHeader title="Service Schedule" />

      {/* View toggle */}
      <div className="tabs">
        {[
          { key: 'calendar', label: 'Calendar' },
          { key: 'list', label: 'List' },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab ${view === t.key ? 'tab--active' : ''}`}
            onClick={() => setView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <div className="cal">
          <div className="cal-nav">
            <button className="nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>
              ‹
            </button>
            <span className="nav-label">
              {fmtDate(dateKey(weekDays[0]))} – {fmtDate(dateKey(weekDays[6]))}
            </span>
            <button className="nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>
              ›
            </button>
          </div>
          {weekOffset !== 0 && (
            <button className="today-btn" onClick={() => setWeekOffset(0)}>
              Today
            </button>
          )}
          <div className="days">
            {weekDays.map((d) => {
              const key = dateKey(d)
              const dayCalls = callsByDate[key] || []
              const isToday = key === todayKey
              return (
                <div key={key} className={`day ${isToday ? 'day--today' : ''}`}>
                  <div className="day-head">
                    <span className="day-name">{DAY_NAMES[d.getDay()]}</span>
                    <span className="day-num">{d.getDate()}</span>
                  </div>
                  <div className="day-body">
                    {dayCalls.map((call) => {
                      const color = call.biz_service_types?.color || C
                      return (
                        <button
                          key={call.id}
                          className="chip"
                          style={{ borderLeftColor: color }}
                          onClick={() => router.push(`/service-schedule/${call.id}`)}
                        >
                          <span className="chip-time">{fmtTime(call.scheduled_time)}</span>
                          <span className="chip-name">{customerName(call)}</span>
                          {call.biz_service_types?.name && (
                            <span className="chip-type" style={{ color }}>
                              {call.biz_service_types.name}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="list">
          {initialCalls.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔧</div>
              No service calls scheduled
            </div>
          ) : (
            initialCalls.map((call) => {
              const color = call.biz_service_types?.color || C
              return (
                <button
                  key={call.id}
                  className="row"
                  style={{ borderLeftColor: color }}
                  onClick={() => router.push(`/service-schedule/${call.id}`)}
                >
                  <div className="row-main">
                    <div className="row-top">
                      <span className="row-name">{customerName(call)}</span>
                      <StatusDot status={call.status} />
                    </div>
                    <div className="row-sub">
                      {fmtDate(call.scheduled_date)}
                      {call.scheduled_time ? ` · ${fmtTime(call.scheduled_time)}` : ''}
                    </div>
                    <div className="row-sub">
                      {call.biz_service_types?.name && (
                        <span style={{ color, fontWeight: 600 }}>
                          {call.biz_service_types.name}
                        </span>
                      )}
                      {call.assigned_tech ? ` · ${call.assigned_tech}` : ''}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <button className="add-btn" onClick={() => router.push('/service-schedule/new')}>
          + Schedule Service
        </button>
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
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

        /* Calendar */
        .cal {
          flex: 1;
          padding: 12px;
        }
        .cal-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .nav-btn {
          width: 36px;
          height: 36px;
          border: 1.5px solid ${C_BORDER};
          background: #fff;
          border-radius: 6px;
          font-size: 20px;
          color: ${C};
          cursor: pointer;
        }
        .nav-label {
          font-size: 14px;
          font-weight: 700;
          color: ${C};
        }
        .today-btn {
          display: block;
          margin: 0 auto 10px;
          background: #f5f8ff;
          border: 1.5px solid ${C};
          color: ${C};
          border-radius: 6px;
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .days {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .day {
          border: 1.5px solid ${C_BORDER};
          border-radius: 8px;
          overflow: hidden;
        }
        .day--today {
          border-color: ${C};
        }
        .day-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #f5f8ff;
          border-bottom: 1.5px solid ${C_BORDER};
        }
        .day-name {
          font-size: 12px;
          font-weight: 700;
          color: ${C_MUTED};
        }
        .day-num {
          font-size: 14px;
          font-weight: 700;
          color: ${C};
        }
        .day-body {
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 12px;
        }
        .chip {
          display: flex;
          align-items: baseline;
          gap: 6px;
          width: 100%;
          text-align: left;
          background: #fafcff;
          border: 1px solid ${C_BORDER};
          border-left: 4px solid ${C};
          border-radius: 5px;
          padding: 6px 8px;
          cursor: pointer;
          font-family: inherit;
          flex-wrap: wrap;
        }
        .chip-time {
          font-size: 11px;
          font-weight: 700;
          color: ${C_MUTED};
        }
        .chip-name {
          font-size: 13px;
          font-weight: 600;
          color: ${C};
        }
        .chip-type {
          font-size: 11px;
          font-weight: 600;
        }

        /* List */
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
          border-left: 4px solid ${C};
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
        .row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 3px;
        }
        .row-name {
          font-size: 15px;
          font-weight: 700;
          color: ${C};
        }
        .row-sub {
          font-size: 13px;
          color: ${C_MUTED};
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
