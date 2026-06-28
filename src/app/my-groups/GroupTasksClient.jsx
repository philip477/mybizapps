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

// Priority options for the add-task form — value is the raw DB string.
const PRIORITY_OPTIONS = [
  ['urgent', 'Urgent'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['normal', 'Normal'],
  ['low', 'Low'],
]

// Shared field styles for the management modals.
const FIELD_LABEL = { fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 }
const FIELD_INPUT = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15, outline: 'none', marginBottom: 12, background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif" }

function personName(u) {
  if (!u) return ''
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return n || u.email || 'Unknown'
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
  myRole = null,
  myFacilityId = null,
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
  // Groups and memberships live in state so create / edit / delete and
  // add-self-as-admin reflect immediately without a round-trip reload.
  const [groups, setGroups] = useState(initialGroups)
  const [memberships, setMemberships] = useState(initialMemberships)

  // super_user (and master_control) can create and manage any group in their
  // facility. Regular group admins manage only the groups they're admin of.
  const isSuper = myRole === 'super_user' || myRole === 'master_control'

  // Inline self-admin: task creators (and group admins) can edit / delete.
  const [editTask, setEditTask]   = useState(null)
  const [editForm, setEditForm]   = useState({ title: '', description: '', cadence: '', due_date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState(null)

  // Create / edit a group.
  const [groupModal, setGroupModal] = useState(null) // 'create' | { ...group } when editing
  const [groupForm, setGroupForm]   = useState({ name: '', description: '', active: true })
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupError, setGroupError]   = useState(null)

  // Manage members of a group.
  const [membersGroup, setMembersGroup] = useState(null)
  const [members, setMembers]           = useState([])      // rows from biz_group_members (+ derived name)
  const [facilityUsers, setFacilityUsers] = useState([])    // candidates from biz_users
  const [memberSearch, setMemberSearch] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError]     = useState(null)

  // Add a task to a group.
  const [taskGroup, setTaskGroup] = useState(null)
  const [taskForm, setTaskForm]   = useState({ title: '', description: '', cadence: '', priority: 'normal', due_date: '' })
  const [taskSaving, setTaskSaving] = useState(false)
  const [taskError, setTaskError]   = useState(null)

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
    () => new Set(memberships.map(m => m.group_id)),
    [memberships]
  )
  const adminGroupIds = useMemo(
    () => new Set(memberships.filter(m => m.is_admin).map(m => m.group_id)),
    [memberships]
  )
  const groupNameById = useMemo(() => {
    const m = {}
    for (const g of groups) m[g.id] = g.name
    return m
  }, [groups])

  // Groups visible in this view: super_users see every facility group; everyone
  // else sees only the groups they belong to.
  const myGroups = useMemo(
    () => isSuper ? groups : groups.filter(g => myGroupIds.has(g.id)),
    [groups, myGroupIds, isSuper]
  )

  // Whether the caller can manage (edit / members / tasks) a given group.
  function canManageGroup(groupId) {
    return isSuper || adminGroupIds.has(groupId)
  }

  const visibleGroupIds = useMemo(
    () => new Set(myGroups.map(g => g.id)),
    [myGroups]
  )

  const dropdownOptions = useMemo(() => {
    const opts = [{ id: 'all', label: isSuper ? 'All Groups' : 'All My Groups' }]
    myGroups.forEach(g => opts.push({ id: g.id, label: g.name }))
    return opts
  }, [myGroups, isSuper])

  // Tasks belonging to the visible groups.
  const myTasks = useMemo(
    () => tasks.filter(t => t.group_id && visibleGroupIds.has(t.group_id)),
    [tasks, visibleGroupIds]
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
    if (isSuper) return true
    if (task.created_by && task.created_by === myUserId) return true
    return adminGroupIds.has(task.group_id)
  }

  // ---- Group create / edit / delete ----------------------------------------

  function openCreateGroup() {
    setGroupError(null)
    setGroupForm({ name: '', description: '', active: true })
    setGroupModal('create')
  }

  function openEditGroup(group) {
    setGroupError(null)
    setGroupForm({ name: group.name || '', description: group.description || '', active: group.active !== false })
    setGroupModal(group)
  }

  function closeGroupModal() {
    if (groupSaving) return
    setGroupModal(null)
    setGroupError(null)
  }

  async function saveGroup() {
    const name = groupForm.name.trim()
    if (!name) { setGroupError('Group name is required.'); return }
    setGroupSaving(true)
    setGroupError(null)

    if (groupModal === 'create') {
      if (!myFacilityId) { setGroupError('Could not determine your facility.'); setGroupSaving(false); return }
      const { data, error } = await supabase
        .from('biz_groups')
        .insert({
          facility_id: myFacilityId,
          name,
          description: groupForm.description.trim() || null,
          active: true,
        })
        .select()
        .single()
      if (error) { setGroupError(error.message); setGroupSaving(false); return }
      // The creator becomes a group admin so the group lands in their list.
      const { error: memErr } = await supabase
        .from('biz_group_members')
        .insert({ group_id: data.id, user_id: myUserId, member_role: 'group_admin', is_admin: true })
      if (memErr) { setGroupError(memErr.message); setGroupSaving(false); return }
      setGroups(prev => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setMemberships(prev => [...prev, { group_id: data.id, is_admin: true }])
      setSelectedGroup(data.id)
      setGroupSaving(false)
      setGroupModal(null)
      return
    }

    // Editing an existing group.
    const patch = {
      name,
      description: groupForm.description.trim() || null,
      active: !!groupForm.active,
    }
    const { error } = await supabase
      .from('biz_groups')
      .update(patch)
      .eq('id', groupModal.id)
    if (error) { setGroupError(error.message); setGroupSaving(false); return }
    if (patch.active) {
      setGroups(prev => prev.map(g => g.id === groupModal.id ? { ...g, ...patch } : g))
    } else {
      // Deactivated groups drop out of the (active-only) list.
      setGroups(prev => prev.filter(g => g.id !== groupModal.id))
      if (selectedGroup === groupModal.id) setSelectedGroup('all')
    }
    setGroupSaving(false)
    setGroupModal(null)
  }

  async function deleteGroup() {
    if (!groupModal || groupModal === 'create') return
    if (!confirm(`Delete "${groupModal.name}"? It will be archived and its tasks hidden.`)) return
    setGroupSaving(true)
    setGroupError(null)
    const { error } = await supabase
      .from('biz_groups')
      .update({ active: false })
      .eq('id', groupModal.id)
    if (error) { setGroupError(error.message); setGroupSaving(false); return }
    setGroups(prev => prev.filter(g => g.id !== groupModal.id))
    setMemberships(prev => prev.filter(m => m.group_id !== groupModal.id))
    if (selectedGroup === groupModal.id) setSelectedGroup('all')
    setGroupSaving(false)
    setGroupModal(null)
  }

  // ---- Member management ----------------------------------------------------

  async function openMembers(group) {
    setMembersGroup(group)
    setMemberSearch('')
    setMembersError(null)
    setMembersLoading(true)
    const [{ data: mem, error: memErr }, { data: users, error: usrErr }] = await Promise.all([
      supabase
        .from('biz_group_members')
        .select('id, user_id, member_role, is_admin')
        .eq('group_id', group.id),
      supabase
        .from('biz_users')
        .select('id, first_name, last_name, email')
        .eq('facility_id', myFacilityId)
        .eq('active', true)
        .order('last_name'),
    ])
    if (memErr || usrErr) {
      setMembersError((memErr || usrErr).message)
      setMembersLoading(false)
      return
    }
    const byId = {}
    for (const u of users || []) byId[u.id] = u
    setFacilityUsers(users || [])
    setMembers((mem || []).map(m => ({ ...m, user: byId[m.user_id] || null })))
    setMembersLoading(false)
  }

  function closeMembers() {
    setMembersGroup(null)
    setMembers([])
    setFacilityUsers([])
    setMembersError(null)
  }

  async function addMember(user) {
    if (!membersGroup) return
    setMembersError(null)
    const { data, error } = await supabase
      .from('biz_group_members')
      .insert({ group_id: membersGroup.id, user_id: user.id, member_role: 'member', is_admin: false })
      .select()
      .single()
    if (error) { setMembersError(error.message); return }
    setMembers(prev => [...prev, { ...data, user }])
    if (user.id === myUserId) setMemberships(prev => [...prev, { group_id: membersGroup.id, is_admin: false }])
  }

  async function removeMember(member) {
    if (!membersGroup) return
    const adminCount = members.filter(m => m.is_admin).length
    if (member.is_admin && adminCount <= 1) {
      setMembersError('Cannot remove the last admin of a group.')
      return
    }
    setMembersError(null)
    const { error } = await supabase
      .from('biz_group_members')
      .delete()
      .eq('id', member.id)
    if (error) { setMembersError(error.message); return }
    setMembers(prev => prev.filter(m => m.id !== member.id))
    if (member.user_id === myUserId) setMemberships(prev => prev.filter(m => m.group_id !== membersGroup.id))
  }

  async function toggleMemberAdmin(member) {
    if (!membersGroup) return
    const adminCount = members.filter(m => m.is_admin).length
    if (member.is_admin && adminCount <= 1) {
      setMembersError('A group must keep at least one admin.')
      return
    }
    setMembersError(null)
    const nextAdmin = !member.is_admin
    const { error } = await supabase
      .from('biz_group_members')
      .update({ is_admin: nextAdmin, member_role: nextAdmin ? 'group_admin' : 'member' })
      .eq('id', member.id)
    if (error) { setMembersError(error.message); return }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_admin: nextAdmin, member_role: nextAdmin ? 'group_admin' : 'member' } : m))
    if (member.user_id === myUserId) {
      setMemberships(prev => prev.map(m => m.group_id === membersGroup.id ? { ...m, is_admin: nextAdmin } : m))
    }
  }

  // ---- Add a task to a group ------------------------------------------------

  function openAddTask(group) {
    setTaskError(null)
    setTaskForm({ title: '', description: '', cadence: '', priority: 'normal', due_date: '' })
    setTaskGroup(group)
  }

  function closeAddTask() {
    if (taskSaving) return
    setTaskGroup(null)
    setTaskError(null)
  }

  async function saveTask() {
    if (!taskGroup) return
    const title = taskForm.title.trim()
    if (!title) { setTaskError('Task title is required.'); return }
    if (!taskForm.cadence) { setTaskError('Cadence is required.'); return }
    const needsDate = ['due_date', 'one_time'].includes(taskForm.cadence)
    if (needsDate && !taskForm.due_date) { setTaskError('Due date is required for this cadence.'); return }
    setTaskSaving(true)
    setTaskError(null)
    const { data, error } = await supabase
      .from('biz_group_tasks')
      .insert({
        facility_id: myFacilityId,
        group_id: taskGroup.id,
        app_id: null,
        title,
        description: taskForm.description.trim() || null,
        cadence: taskForm.cadence,
        priority: taskForm.priority || null,
        due_date: needsDate ? taskForm.due_date : null,
        active: true,
        created_by: myUserId,
      })
      .select()
      .single()
    if (error) { setTaskError(error.message); setTaskSaving(false); return }
    setTasks(prev => [...prev, data])
    setTaskSaving(false)
    setTaskGroup(null)
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

      {/* Super users can create groups from here. */}
      {isSuper && (
        <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={openCreateGroup}
            style={{
              background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> New Group
          </button>
        </div>
      )}

      {/* No groups → friendly empty state */}
      {myGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#5580a0' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0', marginBottom: 6 }}>
            {isSuper ? 'No groups yet' : 'You’re not in any groups yet'}
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>
            {isSuper
              ? 'Create a group to start adding members and tasks.'
              : 'Once you’re added to a group, its tasks will show up here.'}
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

          {/* Management toolbar — shown when a specific group the caller can
              manage is selected. */}
          {selectedGroup !== 'all' && canManageGroup(selectedGroup) && (
            <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(() => {
                const g = groups.find(gr => gr.id === selectedGroup)
                if (!g) return null
                const btn = {
                  flex: 1, minWidth: 100, padding: '9px 10px',
                  background: '#EEF3FB', color: '#1a56a0', border: '1.5px solid #1a56a0',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }
                return (
                  <>
                    <button style={btn} onClick={() => openAddTask(g)}>➕ Add Task</button>
                    <button style={btn} onClick={() => openMembers(g)}>👥 Members</button>
                    <button style={btn} onClick={() => openEditGroup(g)}>✏️ Edit Group</button>
                  </>
                )
              })()}
            </div>
          )}

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

      {/* Create / edit group modal */}
      {groupModal && (
        <div
          onClick={closeGroupModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#1a56a0' }}>
                {groupModal === 'create' ? 'New Group' : 'Edit Group'}
              </div>
              <button onClick={closeGroupModal} style={{ background: 'none', border: 'none', fontSize: 22, color: '#5580a0', cursor: 'pointer', padding: 0 }} aria-label="Close">×</button>
            </div>

            <label style={FIELD_LABEL}>Group Name</label>
            <input
              value={groupForm.name}
              onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
              style={FIELD_INPUT}
            />

            <label style={FIELD_LABEL}>Description</label>
            <textarea
              value={groupForm.description}
              onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ ...FIELD_INPUT, fontSize: 14, resize: 'vertical' }}
            />

            {groupModal !== 'create' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 14, color: '#1A1A2E' }}>
                <input
                  type="checkbox"
                  checked={!!groupForm.active}
                  onChange={e => setGroupForm(f => ({ ...f, active: e.target.checked }))}
                  style={{ width: 18, height: 18 }}
                />
                Active
              </label>
            )}

            {groupError && (
              <div style={{ background: '#fde8e8', color: '#b02020', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{groupError}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {groupModal !== 'create' && (
                <button onClick={deleteGroup} disabled={groupSaving} style={{ flex: '0 0 auto', padding: '11px 16px', background: '#fff', color: '#b02020', border: '1.5px solid #f5c6c6', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: groupSaving ? 'default' : 'pointer', opacity: groupSaving ? 0.6 : 1 }}>Delete</button>
              )}
              <button onClick={closeGroupModal} disabled={groupSaving} style={{ flex: 1, padding: '11px 16px', background: '#fff', color: '#1a56a0', border: '1.5px solid #1a56a0', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: groupSaving ? 'default' : 'pointer', opacity: groupSaving ? 0.6 : 1 }}>Cancel</button>
              <button onClick={saveGroup} disabled={groupSaving} style={{ flex: 1, padding: '11px 16px', background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: groupSaving ? 'default' : 'pointer', opacity: groupSaving ? 0.6 : 1 }}>{groupSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage members modal */}
      {membersGroup && (
        <div
          onClick={closeMembers}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#1a56a0' }}>Members · {membersGroup.name}</div>
              <button onClick={closeMembers} style={{ background: 'none', border: 'none', fontSize: 22, color: '#5580a0', cursor: 'pointer', padding: 0 }} aria-label="Close">×</button>
            </div>

            {membersError && (
              <div style={{ background: '#fde8e8', color: '#b02020', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{membersError}</div>
            )}

            {membersLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#888', fontSize: 14 }}>Loading…</div>
            ) : (
              <>
                {/* Current members */}
                <div style={{ ...FIELD_LABEL, marginBottom: 6 }}>Current Members ({members.length})</div>
                {members.length === 0 && (
                  <div style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>No members yet.</div>
                )}
                <div style={{ marginBottom: 14 }}>
                  {members
                    .slice()
                    .sort((a, b) => personName(a.user).localeCompare(personName(b.user)))
                    .map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #eef1f6' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{personName(m.user)}</div>
                          {m.user?.email && <div style={{ fontSize: 12, color: '#888' }}>{m.user.email}</div>}
                        </div>
                        <button
                          onClick={() => toggleMemberAdmin(m)}
                          title={m.is_admin ? 'Demote to member' : 'Make admin'}
                          style={{
                            flexShrink: 0, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: m.is_admin ? '#EEF3FB' : '#F5F5F5',
                            color: m.is_admin ? '#1a56a0' : '#777',
                            border: `1px solid ${m.is_admin ? '#90b4e0' : '#ddd'}`,
                          }}
                        >
                          {m.is_admin ? 'Admin' : 'Member'}
                        </button>
                        <button
                          onClick={() => removeMember(m)}
                          aria-label="Remove member"
                          title="Remove from group"
                          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #f5c6c6', background: '#fff', color: '#b02020', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>

                {/* Add members */}
                <div style={{ ...FIELD_LABEL, marginBottom: 6 }}>Add Members</div>
                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search people…"
                  style={{ ...FIELD_INPUT, marginBottom: 8 }}
                />
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #eef1f6', borderRadius: 8 }}>
                  {(() => {
                    const memberIds = new Set(members.map(m => m.user_id))
                    const q = memberSearch.trim().toLowerCase()
                    const candidates = facilityUsers.filter(u => {
                      if (memberIds.has(u.id)) return false
                      if (!q) return true
                      return personName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                    })
                    if (candidates.length === 0) {
                      return <div style={{ padding: '12px', fontSize: 13, color: '#999', textAlign: 'center' }}>No matching people</div>
                    }
                    return candidates.map(u => (
                      <div
                        key={u.id}
                        onClick={() => addMember(u)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f2f4f8' }}
                      >
                        <span style={{ color: '#1a56a0', fontSize: 16, fontWeight: 700 }}>＋</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{personName(u)}</div>
                          {u.email && <div style={{ fontSize: 12, color: '#888' }}>{u.email}</div>}
                        </div>
                      </div>
                    ))
                  })()}
                </div>

                <button onClick={closeMembers} style={{ marginTop: 14, padding: '11px 16px', background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Done</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add task modal */}
      {taskGroup && (
        <div
          onClick={closeAddTask}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#1a56a0' }}>Add Task · {taskGroup.name}</div>
              <button onClick={closeAddTask} style={{ background: 'none', border: 'none', fontSize: 22, color: '#5580a0', cursor: 'pointer', padding: 0 }} aria-label="Close">×</button>
            </div>

            <label style={FIELD_LABEL}>Task Title</label>
            <input
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              style={FIELD_INPUT}
            />

            <label style={FIELD_LABEL}>Description</label>
            <textarea
              value={taskForm.description}
              onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ ...FIELD_INPUT, fontSize: 14, resize: 'vertical' }}
            />

            <label style={FIELD_LABEL}>Cadence</label>
            <select
              value={taskForm.cadence}
              onChange={e => setTaskForm(f => ({ ...f, cadence: e.target.value }))}
              style={FIELD_INPUT}
            >
              <option value="">— Select —</option>
              {CADENCE_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>

            <label style={FIELD_LABEL}>Priority</label>
            <select
              value={taskForm.priority}
              onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
              style={FIELD_INPUT}
            >
              {PRIORITY_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>

            {['due_date', 'one_time'].includes(taskForm.cadence) && (
              <>
                <label style={FIELD_LABEL}>Due Date</label>
                <input
                  type="date"
                  value={taskForm.due_date || ''}
                  onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                  style={FIELD_INPUT}
                />
              </>
            )}

            {taskError && (
              <div style={{ background: '#fde8e8', color: '#b02020', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{taskError}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={closeAddTask} disabled={taskSaving} style={{ flex: 1, padding: '11px 16px', background: '#fff', color: '#1a56a0', border: '1.5px solid #1a56a0', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: taskSaving ? 'default' : 'pointer', opacity: taskSaving ? 0.6 : 1 }}>Cancel</button>
              <button onClick={saveTask} disabled={taskSaving} style={{ flex: 1, padding: '11px 16px', background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: taskSaving ? 'default' : 'pointer', opacity: taskSaving ? 0.6 : 1 }}>{taskSaving ? 'Saving…' : 'Add Task'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
