'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// My Groups — group membership browser.
//
// Lists the groups the caller belongs to (super users see every facility
// group). Tapping a group card expands it to reveal its members with a role
// badge and an admin marker. Group admins (and super users) get inline
// management: create groups, edit a group, and add / remove / promote members.
//
// There is intentionally NO task UI here — group tasks live on /my-tasks.

// Shared field styles for the management modals.
const FIELD_LABEL = { fontSize: 12, fontWeight: 700, color: '#5580a0', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 }
const FIELD_INPUT = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15, outline: 'none', marginBottom: 12, background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif" }

function personName(u) {
  if (!u) return 'Unknown'
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return n || u.email || 'Unknown'
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

function AvatarCircle({ name, size = 38, admin = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: admin ? '#1a56a0' : '#5580a0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
    }}>
      {initials(name)}
    </div>
  )
}

export default function MyGroupsClient({
  appName = 'My Groups',
  myUserId = null,
  myRole = null,
  myFacilityId = null,
  initialGroups = [],
  initialMembers = [],
  initialUsers = [],
}) {
  const router = useRouter()

  // Groups, all membership rows, and facility users live in state so that
  // create / edit / delete and member changes reflect immediately.
  const [groups, setGroups]   = useState(initialGroups)
  const [members, setMembers] = useState(initialMembers)
  const [users]               = useState(initialUsers)
  const [search, setSearch]   = useState('')

  // Which group cards are expanded to show their members.
  const [expanded, setExpanded] = useState(() => new Set())

  // super_user (and master_control) can see and manage every group in their
  // facility. Regular members can only manage groups they're an admin of.
  const isSuper = myRole === 'super_user' || myRole === 'master_control'

  // Create / edit a group.
  const [groupModal, setGroupModal] = useState(null) // 'create' | { ...group } when editing
  const [groupForm, setGroupForm]   = useState({ name: '', description: '', active: true })
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupError, setGroupError]   = useState(null)

  // Manage members of a group.
  const [membersGroup, setMembersGroup] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [membersError, setMembersError] = useState(null)

  const usersById = useMemo(() => {
    const m = {}
    for (const u of users) m[u.id] = u
    return m
  }, [users])

  const membersByGroup = useMemo(() => {
    const m = {}
    for (const row of members) {
      if (!m[row.group_id]) m[row.group_id] = []
      m[row.group_id].push({ ...row, user: usersById[row.user_id] || null })
    }
    return m
  }, [members, usersById])

  const myGroupIds = useMemo(
    () => new Set(members.filter(m => m.user_id === myUserId).map(m => m.group_id)),
    [members, myUserId]
  )
  const adminGroupIds = useMemo(
    () => new Set(members.filter(m => m.user_id === myUserId && m.is_admin).map(m => m.group_id)),
    [members, myUserId]
  )

  // Whether the caller can manage (edit / members) a given group.
  function canManageGroup(groupId) {
    return isSuper || adminGroupIds.has(groupId)
  }

  // Groups visible in this view: super users see every facility group;
  // everyone else sees only the groups they belong to.
  const myGroups = useMemo(
    () => isSuper ? groups : groups.filter(g => myGroupIds.has(g.id)),
    [groups, myGroupIds, isSuper]
  )

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return myGroups
    return myGroups.filter(g =>
      (g.name || '').toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    )
  }, [myGroups, search])

  function toggleExpanded(groupId) {
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(groupId)) s.delete(groupId)
      else s.add(groupId)
      return s
    })
  }

  // Members of a group, sorted admins-first then by name.
  function sortedMembers(groupId) {
    return (membersByGroup[groupId] || []).slice().sort((a, b) => {
      if (!!b.is_admin !== !!a.is_admin) return b.is_admin ? 1 : -1
      return personName(a.user).localeCompare(personName(b.user))
    })
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
      // The creator becomes a group admin (leader) so the group lands in their
      // list and they can manage it.
      const { data: memRow, error: memErr } = await supabase
        .from('biz_group_members')
        .insert({ group_id: data.id, user_id: myUserId, member_role: 'leader', is_admin: true })
        .select('id, group_id, user_id, member_role, is_admin')
        .single()
      if (memErr) {
        // Roll back the orphaned group so it doesn't linger member-less.
        await supabase.from('biz_groups').delete().eq('id', data.id)
        setGroupError(memErr.message); setGroupSaving(false); return
      }
      setGroups(prev => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setMembers(prev => [...prev, memRow])
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
    }
    setGroupSaving(false)
    setGroupModal(null)
  }

  async function deleteGroup() {
    if (!groupModal || groupModal === 'create') return
    if (!confirm(`Delete "${groupModal.name}"? It will be archived and removed from everyone's list.`)) return
    setGroupSaving(true)
    setGroupError(null)
    const { error } = await supabase
      .from('biz_groups')
      .update({ active: false })
      .eq('id', groupModal.id)
    if (error) { setGroupError(error.message); setGroupSaving(false); return }
    setGroups(prev => prev.filter(g => g.id !== groupModal.id))
    setGroupSaving(false)
    setGroupModal(null)
  }

  // ---- Member management ----------------------------------------------------

  function openMembers(group) {
    setMembersGroup(group)
    setMemberSearch('')
    setMembersError(null)
  }

  function closeMembers() {
    setMembersGroup(null)
    setMembersError(null)
  }

  async function addMember(user) {
    if (!membersGroup) return
    setMembersError(null)
    const { data, error } = await supabase
      .from('biz_group_members')
      .insert({ group_id: membersGroup.id, user_id: user.id, member_role: 'member', is_admin: false })
      .select('id, group_id, user_id, member_role, is_admin')
      .single()
    if (error) { setMembersError(error.message); return }
    setMembers(prev => [...prev, data])
  }

  async function removeMember(member) {
    if (!membersGroup) return
    const adminCount = (membersByGroup[membersGroup.id] || []).filter(m => m.is_admin).length
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
  }

  async function toggleMemberAdmin(member) {
    if (!membersGroup) return
    const adminCount = (membersByGroup[membersGroup.id] || []).filter(m => m.is_admin).length
    if (member.is_admin && adminCount <= 1) {
      setMembersError('A group must keep at least one admin.')
      return
    }
    setMembersError(null)
    const nextAdmin = !member.is_admin
    const { error } = await supabase
      .from('biz_group_members')
      .update({ is_admin: nextAdmin, member_role: nextAdmin ? 'leader' : 'member' })
      .eq('id', member.id)
    if (error) { setMembersError(error.message); return }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_admin: nextAdmin, member_role: nextAdmin ? 'leader' : 'member' } : m))
  }

  const totalMembers = useMemo(
    () => new Set(members.filter(m => myGroups.some(g => g.id === m.group_id)).map(m => m.user_id)).size,
    [members, myGroups]
  )

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
              ? 'Create a group to start adding members.'
              : 'Once you’re added to a group, it will show up here.'}
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
                placeholder="Search groups..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px',
                  border: '1.5px solid #d0e0f4', borderRadius: 8, fontSize: 15,
                  background: '#fff', outline: 'none', color: '#1A1A2E',
                }}
              />
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{ padding: '14px 16px 8px', display: 'flex', gap: 8 }}>
            {[
              { label: isSuper ? 'Groups' : 'My Groups', value: myGroups.length, color: '#1a56a0' },
              { label: 'Members', value: totalMembers, color: '#00ACC1' },
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

          {/* Group cards */}
          <div style={{ padding: '0 16px 24px' }}>
            {filteredGroups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 15 }}>
                No groups found
              </div>
            )}
            {filteredGroups.map(group => {
              const groupMembers = sortedMembers(group.id)
              const adminCount   = groupMembers.filter(m => m.is_admin).length
              const isOpen       = expanded.has(group.id)
              const canManage    = canManageGroup(group.id)
              return (
                <div key={group.id} style={{
                  background: '#fff',
                  border: '1px solid #E0E0E0',
                  borderLeft: '4px solid #1a56a0',
                  borderRadius: 10,
                  marginBottom: 10,
                  overflow: 'hidden',
                }}>
                  {/* Group header row — tap to expand */}
                  <div
                    onClick={() => toggleExpanded(group.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: '#1a56a0', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 19,
                    }}>
                      👥
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {group.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#5580a0', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}</span>
                        {adminCount > 0 && (
                          <span style={{ background: '#fff8e8', color: '#c97a00', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>
                            ★ {adminCount} admin{adminCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: '#1a56a0', fontSize: 16, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded body — member list + (admin) management */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #eef0f4', padding: '6px 14px 12px' }}>
                      {group.description && (
                        <div style={{ fontSize: 13, color: '#777', padding: '8px 0 4px', lineHeight: 1.35 }}>
                          {group.description}
                        </div>
                      )}

                      {groupMembers.length === 0 ? (
                        <div style={{ padding: '14px 0', textAlign: 'center', color: '#999', fontSize: 13 }}>
                          No members yet.
                        </div>
                      ) : (
                        groupMembers.map(m => (
                          <div key={m.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 0', borderBottom: '1px solid #f2f4f8',
                          }}>
                            <AvatarCircle name={personName(m.user)} size={34} admin={m.is_admin} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {m.is_admin && <span style={{ color: '#f5a623' }} title="Admin">★</span>}
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{personName(m.user)}</span>
                              </div>
                              {m.user?.email && (
                                <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.user.email}</div>
                              )}
                            </div>
                            <span style={{
                              flexShrink: 0,
                              background: m.is_admin ? '#fff8e8' : '#f0f6ff',
                              color: m.is_admin ? '#c97a00' : '#1a56a0',
                              border: `1px solid ${m.is_admin ? '#ffe082' : '#d0e0f4'}`,
                              borderRadius: 20, padding: '2px 10px',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {m.is_admin ? 'Leader' : 'Member'}
                            </span>
                          </div>
                        ))
                      )}

                      {/* Management actions for admins / super users */}
                      {canManage && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); openMembers(group) }}
                            style={{
                              flex: 1, padding: '9px 10px',
                              background: '#EEF3FB', color: '#1a56a0', border: '1.5px solid #1a56a0',
                              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            }}
                          >
                            👥 Members
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditGroup(group) }}
                            style={{
                              flex: 1, padding: '9px 10px',
                              background: '#fff', color: '#5580a0', border: '1.5px solid #d0e0f4',
                              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            }}
                          >
                            ✏️ Edit Group
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
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

            {/* Current members */}
            {(() => {
              const groupMembers = sortedMembers(membersGroup.id)
              return (
                <>
                  <div style={{ ...FIELD_LABEL, marginBottom: 6 }}>Current Members ({groupMembers.length})</div>
                  {groupMembers.length === 0 && (
                    <div style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>No members yet.</div>
                  )}
                  <div style={{ marginBottom: 14 }}>
                    {groupMembers.map(m => (
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
                            background: m.is_admin ? '#fff8e8' : '#F5F5F5',
                            color: m.is_admin ? '#c97a00' : '#777',
                            border: `1px solid ${m.is_admin ? '#ffe082' : '#ddd'}`,
                          }}
                        >
                          {m.is_admin ? '★ Leader' : 'Member'}
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
                      const memberIds = new Set(groupMembers.map(m => m.user_id))
                      const q = memberSearch.trim().toLowerCase()
                      const candidates = users.filter(u => {
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
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
