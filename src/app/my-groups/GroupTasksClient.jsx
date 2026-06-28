'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// Cadence is stored lowercase on biz_group_tasks.cadence
// (daily | weekly | monthly | quarterly | annual | due_date | one_time).
// Each gets a label + chip color, mirroring the MyLTC task-type palette.
const CADENCE_META = {
  daily:     { label: 'Daily',     bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  weekly:    { label: 'Weekly',    bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' },
  monthly:   { label: 'Monthly',   bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8' },
  quarterly: { label: 'Quarterly', bg: '#FCE4EC', text: '#880E4F', border: '#F48FB1' },
  annual:    { label: 'Annual',    bg: '#E8EAF6', text: '#283593', border: '#9FA8DA' },
  due_date:  { label: 'Due Date',  bg: '#F5F5F5', text: '#424242', border: '#BDBDBD' },
  one_time:  { label: 'One-Time',  bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' },
}

// Cadence options for the edit modal — value is the raw DB string.
const CADENCE_OPTIONS = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['annual', 'Annual'],
  ['due_date', 'Due Date'],
  ['one_time', 'One-Time'],
]

// Priority is free-text on biz_group_tasks.priority. Render a chip only for
// recognized levels; anything else is hidden rather than shown raw.
const PRIORITY_META = {
  urgent: { label: 'Urgent', bg: '#FFEBEE', text: '#B71C1C', border: '#E57373' },
  high:   { label: 'High',   bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  medium: { label: 'Medium', bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' },
  normal: { label: 'Normal', bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' },
  low:    { label: 'Low',    bg: '#F1F8E9', text: '#558B2F', border: '#C5E1A5' },
}

function normCadence(c) {
  if (!c) return 'one_time'
  const v = String(c).toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (v === 'annually' || v === 'yearly') return 'annual'
  if (v === 'onetime') return 'one_time'
  if (v === 'duedate') return 'due_date'
  return v
}

function cadenceMeta(c) {
  return CADENCE_META[normCadence(c)] || CADENCE_META.one_time
}

function startOfToday() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// The window a completion must fall in for a task of this cadence to count as
// "done for the current period". Returns null for one-shot cadences (any
// completion ever counts as done).
function periodRange(cadence) {
  const t = startOfToday()
  const c = normCadence(cadence)
  if (c === 'one_time' || c === 'due_date') return null
  if (c === 'weekly') {
    const s = new Date(t); s.setDate(t.getDate() - t.getDay())
    const e = new Date(s); e.setDate(s.getDate() + 6)
    return { start: fmt(s), end: fmt(e) }
  }
  if (c === 'monthly') {
    return { start: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), end: fmt(new Date(t.getFullYear(), t.getMonth() + 1, 0)) }
  }
  if (c === 'quarterly') {
    const q = Math.floor(t.getMonth() / 3)
    return { start: fmt(new Date(t.getFullYear(), q * 3, 1)), end: fmt(new Date(t.getFullYear(), q * 3 + 3, 0)) }
  }
  if (c === 'annual') {
    return { start: fmt(new Date(t.getFullYear(), 0, 1)), end: fmt(new Date(t.getFullYear(), 11, 31)) }
  }
  // daily (and any unknown recurring) — today only
  return { start: fmt(t), end: fmt(t) }
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr + 'T12:00:00') < startOfToday()
}

function formatDate(dateStr) {
  // Recurring tasks often carry no explicit due_date — return empty so the
  // caller can hide the date span instead of rendering "Invalid Date".
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function GroupTasksClient({
  appName = 'My Groups',
  myUserId = null,
  initialGroups = [],
  initialTasks = [],
  initialMemberships = [],
}) {
  const router = useRouter()
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [search, setSearch]               = useState('')
  const [dropdownOpen, setDropdownOpen]   = useState(false)
  // Flat list of { task_id, completed_date } for the current user, used to
  // derive per-task "done this period" status.
  const [myCompletions, setMyCompletions] = useState([])
  const [tasks, setTasks] = useState(initialTasks)

  // Inline self-admin: task creators (and group admins) can edit / delete.
  const [editTask, setEditTask]   = useState(null)
  const [editForm, setEditForm]   = useState({ title: '', description: '', cadence: '', due_date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState(null)

  // Load the current user's completions on mount.
  useEffect(() => {
    if (!myUserId) return
    supabase
      .from('biz_task_completions')
      .select('task_id, completed_date')
      .eq('completed_by', myUserId)
      .then(({ data }) => { if (data) setMyCompletions(data) })
  }, [myUserId])

  const myGroupIds = useMemo(
    () => new Set(initialMemberships.map(m => m.group_id)),
    [initialMemberships]
  )
  const adminGroupIds = useMemo(
    () => new Set(initialMemberships.filter(m => m.is_admin).map(m => m.group_id)),
    [initialMemberships]
  )
  const groupNameById = useMemo(() => {
    const m = {}
    for (const g of initialGroups) m[g.id] = g.name
    return m
  }, [initialGroups])

  // Only groups the user belongs to.
  const myGroups = useMemo(
    () => initialGroups.filter(g => myGroupIds.has(g.id)),
    [initialGroups, myGroupIds]
  )

  const dropdownOptions = useMemo(() => {
    const opts = [{ id: 'all', label: 'All My Groups' }]
    myGroups.forEach(g => opts.push({ id: g.id, label: g.name }))
    return opts
  }, [myGroups])

  // Tasks belonging to the user's groups.
  const myTasks = useMemo(
    () => tasks.filter(t => t.group_id && myGroupIds.has(t.group_id)),
    [tasks, myGroupIds]
  )

  // Set of task ids completed for their current period.
  const doneSet = useMemo(() => {
    const byTask = new Map()
    for (const c of myCompletions) {
      if (!byTask.has(c.task_id)) byTask.set(c.task_id, [])
      byTask.get(c.task_id).push(c.completed_date)
    }
    const s = new Set()
    for (const task of myTasks) {
      const dates = byTask.get(task.id)
      if (!dates || !dates.length) continue
      const range = periodRange(task.cadence)
      if (!range) { s.add(task.id); continue }
      if (dates.some(d => d >= range.start && d <= range.end)) s.add(task.id)
    }
    return s
  }, [myCompletions, myTasks])

  const filteredTasks = useMemo(() => {
    return myTasks.filter(t => {
      const groupMatch  = selectedGroup === 'all' || t.group_id === selectedGroup
      const searchMatch = !search || (t.title || '').toLowerCase().includes(search.toLowerCase())
      return groupMatch && searchMatch
    })
  }, [selectedGroup, search, myTasks])

  const selectedLabel  = dropdownOptions.find(g => g.id === selectedGroup)?.label || 'All My Groups'
  const totalTasks     = filteredTasks.length
  const completedCount = filteredTasks.filter(t => doneSet.has(t.id)).length
  const overdueCount   = filteredTasks.filter(t => !doneSet.has(t.id) && isOverdue(t.due_date)).length

  async function toggleCompletion(task) {
    if (!myUserId) return
    const done = doneSet.has(task.id)
    const today = fmt(startOfToday())
    if (done) {
      const range = periodRange(task.cadence)
      let q = supabase
        .from('biz_task_completions')
        .delete()
        .eq('task_id', task.id)
        .eq('completed_by', myUserId)
      if (range) q = q.gte('completed_date', range.start).lte('completed_date', range.end)
      const { error } = await q
      if (error) { alert('Could not un-check: ' + error.message); return }
      setMyCompletions(prev => prev.filter(c => {
        if (c.task_id !== task.id) return true
        if (!range) return false
        return !(c.completed_date >= range.start && c.completed_date <= range.end)
      }))
    } else {
      const { error } = await supabase
        .from('biz_task_completions')
        .insert({ task_id: task.id, completed_by: myUserId, completed_date: today })
      if (error) { alert('Could not mark complete: ' + error.message); return }
      setMyCompletions(prev => [...prev, { task_id: task.id, completed_date: today }])
    }
  }

  function canAdmin(task) {
    if (!myUserId) return false
    if (task.created_by && task.created_by === myUserId) return true
    return adminGroupIds.has(task.group_id)
  }

  function openEdit(task) {
    setEditError(null)
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      cadence: normCadence(task.cadence),
      due_date: task.due_date || '',
    })
    setEditTask(task)
  }

  function closeEdit() {
    if (editSaving) return
    setEditTask(null)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editTask) return
    const title = editForm.title.trim()
    if (!title) { setEditError('Task title is required.'); return }
    if (!editForm.cadence) { setEditError('Cadence is required.'); return }
    const needsDate = ['due_date', 'one_time'].includes(editForm.cadence)
    if (needsDate && !editForm.due_date) { setEditError('Due date is required for this cadence.'); return }
    setEditSaving(true)
    setEditError(null)
    const patch = {
      title,
      description: editForm.description.trim() || null,
      cadence: editForm.cadence,
      due_date: needsDate ? editForm.due_date : null,
    }
    const { error } = await supabase
      .from('biz_group_tasks')
      .update(patch)
      .eq('id', editTask.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...patch } : t))
    setEditSaving(false)
    setEditTask(null)
  }

  async function deleteEdit() {
    if (!editTask) return
    if (!confirm(`Delete "${editTask.title}"? This cannot be undone.`)) return
    setEditSaving(true)
    setEditError(null)
    const { error } = await supabase
      .from('biz_group_tasks')
      .update({ active: false })
      .eq('id', editTask.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    setTasks(prev => prev.filter(t => t.id !== editTask.id))
    setEditSaving(false)
    setEditTask(null)
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

      <PageHeader title={appName || 'My Groups'} onBack={() => router.back()} />

      {/* No memberships → friendly empty state */}
      {myGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#5580a0' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0', marginBottom: 6 }}>
            You&apos;re not in any groups yet
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>
            Once you&apos;re added to a group, its tasks will show up here.
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div style={{ padding: '14px 16px 0' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#999' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px',
                  border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15,
                  background: '#fff', outline: 'none', color: '#1A1A2E',
                }}
              />
            </div>
          </div>

          {/* Group Dropdown */}
          <div style={{ padding: '12px 16px 0', position: 'relative', zIndex: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 5 }}>
              Filter by Group
            </label>
            <div
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                background: '#fff', border: '1.5px solid #1a56a0', borderRadius: 8,
                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ fontWeight: 600, color: '#1a56a0', fontSize: 15 }}>{selectedLabel}</span>
              <span style={{ color: '#1a56a0', fontSize: 18 }}>{dropdownOpen ? '▲' : '▼'}</span>
            </div>
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 16, right: 16,
                background: '#fff', border: '1.5px solid #1a56a0', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.13)', overflow: 'hidden',
              }}>
                {dropdownOptions.map(g => (
                  <div
                    key={g.id}
                    onClick={() => { setSelectedGroup(g.id); setDropdownOpen(false) }}
                    style={{
                      padding: '11px 16px',
                      cursor: 'pointer', fontSize: 14,
                      fontWeight: g.id === selectedGroup ? 700 : 400,
                      color: g.id === selectedGroup ? '#1a56a0' : '#333',
                      background: g.id === selectedGroup ? '#EEF3FB' : '#fff',
                      borderBottom: '1px solid #d0e0f4',
                    }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div style={{ padding: '14px 16px 8px', display: 'flex', gap: 8 }}>
            {[
              { label: 'Total',    value: totalTasks,      color: '#1a56a0' },
              { label: 'Groups',   value: myGroups.length, color: '#00ACC1' },
              { label: 'Complete', value: completedCount,  color: '#3CB554' },
              { label: 'Overdue',  value: overdueCount,    color: '#E53935' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: '#fff', borderRadius: 8, padding: '8px 6px',
                textAlign: 'center', border: `2px solid ${s.color}22`,
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Task List */}
          <div style={{ padding: '0 16px 24px' }}>
            {filteredTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 15 }}>
                No tasks found
              </div>
            )}
            {filteredTasks.map(task => {
              const cad     = cadenceMeta(task.cadence)
              const done    = doneSet.has(task.id)
              const overdue = !done && isOverdue(task.due_date)
              const prio    = task.priority ? PRIORITY_META[String(task.priority).toLowerCase().trim()] : null
              return (
                <div key={task.id} style={{
                  background: done ? '#F0FBF2' : '#fff',
                  border: `1px solid ${overdue ? '#FFCDD2' : '#E0E0E0'}`,
                  borderLeft: `4px solid ${done ? '#3CB554' : overdue ? '#E53935' : '#1a56a0'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  opacity: done ? 0.75 : 1,
                }}>

                  {/* Checkbox */}
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>
                    <div
                      onClick={() => toggleCompletion(task)}
                      style={{
                        width: 22, height: 22, borderRadius: 5,
                        border: done ? '2px solid #3CB554' : '2px solid #1a56a0',
                        background: done ? '#3CB554' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: myUserId ? 'pointer' : 'default', flexShrink: 0,
                      }}
                    >
                      {done && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>

                  {/* Task details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: done ? 400 : 600, fontSize: 15,
                      color: done ? '#888' : '#1A1A2E',
                      textDecoration: done ? 'line-through' : 'none',
                      lineHeight: 1.3, marginBottom: 6,
                    }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 13, color: '#777', marginBottom: 6, lineHeight: 1.35 }}>
                        {task.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      {/* Group chip (helpful in the "All" view) */}
                      {selectedGroup === 'all' && groupNameById[task.group_id] && (
                        <span style={{
                          background: '#E0F7FA', color: '#00838F',
                          border: '1px solid #80DEEA',
                          borderRadius: 20, padding: '2px 9px',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          👥 {groupNameById[task.group_id]}
                        </span>
                      )}
                      <span style={{
                        background: cad.bg, color: cad.text,
                        border: `1px solid ${cad.border}`,
                        borderRadius: 20, padding: '2px 9px',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {cad.label}
                      </span>
                      {prio && (
                        <span style={{
                          background: prio.bg, color: prio.text,
                          border: `1px solid ${prio.border}`,
                          borderRadius: 20, padding: '2px 9px',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {prio.label}
                        </span>
                      )}
                      {formatDate(task.due_date) && (
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: overdue ? '#E53935' : '#888',
                        }}>
                          {overdue ? '⚠️ ' : '📅 '}
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Self-admin bubble — only for tasks I created or my groups I admin */}
                  {canAdmin(task) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(task) }}
                      aria-label="Edit task"
                      title="Edit task"
                      style={{
                        flexShrink: 0,
                        width: 28, height: 28, borderRadius: '50%',
                        border: '1.5px solid #1a56a0', background: '#EEF3FB',
                        color: '#1a56a0', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Edit modal */}
      {editTask && (
        <div
          onClick={closeEdit}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420,
              padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#1a56a0' }}>Edit Task</div>
              <button
                onClick={closeEdit}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#5580a0', cursor: 'pointer', padding: 0 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
              Task Title
            </label>
            <input
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15,
                outline: 'none', marginBottom: 12, fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
              Description
            </label>
            <textarea
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 14,
                outline: 'none', marginBottom: 12, resize: 'vertical',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
              Cadence
            </label>
            <select
              value={editForm.cadence}
              onChange={e => setEditForm(f => ({ ...f, cadence: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15,
                outline: 'none', marginBottom: 12, background: '#fff',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              <option value="">— Select —</option>
              {CADENCE_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>

            {['due_date', 'one_time'].includes(editForm.cadence) && (
              <>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={editForm.due_date || ''}
                  onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                    border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15,
                    outline: 'none', marginBottom: 12,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                />
              </>
            )}

            {editError && (
              <div style={{ background: '#fde8e8', color: '#b02020', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={deleteEdit}
                disabled={editSaving}
                style={{
                  flex: '0 0 auto', padding: '11px 16px',
                  background: '#fff', color: '#b02020',
                  border: '1.5px solid #f5c6c6', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, cursor: editSaving ? 'default' : 'pointer',
                  opacity: editSaving ? 0.6 : 1,
                }}
              >
                Delete
              </button>
              <button
                onClick={closeEdit}
                disabled={editSaving}
                style={{
                  flex: 1, padding: '11px 16px',
                  background: '#fff', color: '#1a56a0',
                  border: '1.5px solid #1a56a0', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, cursor: editSaving ? 'default' : 'pointer',
                  opacity: editSaving ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{
                  flex: 1, padding: '11px 16px',
                  background: '#1a56a0', color: '#fff',
                  border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, cursor: editSaving ? 'default' : 'pointer',
                  opacity: editSaving ? 0.6 : 1,
                }}
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
