'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// My Docs (Group Documents) — ported from the myltcapps GroupFoldersClient,
// with Dataverse swapped for Supabase. Document rows live in
// biz_group_documents (folders/subfolders are just text fields on each row,
// plus client-side placeholders for empty folders). Uploads go straight from
// the browser to Supabase Storage (a Vercel function would cap the body at
// ~4.5 MB); downloads/previews stream through /api/group-docs/*. All writes —
// row inserts, updates, and the storage object — run as the caller under RLS:
// only facility admins or the group's leader can write, and the storage
// policies tie each object to its legitimately-created row.

const ALL_STAFF_ID = 'all-staff'
const BUCKET = 'group-documents'
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB (also enforced by the bucket's file_size_limit)
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv'])

// A document's group id, normalized: rows with no group (NULL) are "All Staff".
const docGid = (d) => d.group_id || ALL_STAFF_ID

// Friendlier message for an RLS refusal (PostgREST surfaces it as a policy error).
function writeError(error) {
  return error.code === '42501' || /row-level security/i.test(error.message || '')
    ? 'you do not have permission for this group'
    : error.message
}

function formatSize(kb) {
  const n = Number(kb) || 0
  return n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`
}

function getFileExt(fileName) {
  if (!fileName) return ''
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

// Flat document SVG icon with folded corner
function DocTypeIcon({ type }) {
  const MAP = {
    pdf:   { color: '#e53935', label: 'PDF' },
    docx:  { color: '#1a56a0', label: 'DOC' },
    xlsx:  { color: '#2E7D32', label: 'XLS' },
    pptx:  { color: '#e65c00', label: 'PPT' },
    img:   { color: '#6A1B9A', label: 'IMG' },
    other: { color: '#546E7A', label: 'FILE' },
  }
  const { color, label } = MAP[type] || MAP.other
  const fold = 11
  return (
    <svg width="42" height="42" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d={`M4 0 L${38 - fold} 0 L38 ${fold} L38 46 Q38 46 4 46 Q0 46 0 42 L0 4 Q0 0 4 0 Z`} fill="#f5f8ff" stroke="#d0e0f4" strokeWidth="1.5" />
      <path d={`M${38 - fold} 0 L${38 - fold} ${fold} L38 ${fold} Z`} fill={color} opacity="0.25" />
      <path d={`M${38 - fold} 0 L38 ${fold}`} stroke="#d0e0f4" strokeWidth="1.5" />
      <rect x="0" y="28" width="38" height="14" rx="0" fill={color} />
      <path d="M0 28 L0 42 Q0 42 4 42 L34 42 Q38 42 38 42 L38 28 Z" fill={color} />
      <text x="19" y="39" textAnchor="middle" fill="white" fontSize={label.length > 3 ? '7' : '8'} fontWeight="800" fontFamily="Segoe UI, Arial, sans-serif" letterSpacing="0.5">{label}</text>
      <rect x="6" y="10" width="18" height="2" rx="1" fill="#d0e0f4" />
      <rect x="6" y="15" width="22" height="2" rx="1" fill="#d0e0f4" />
      <rect x="6" y="20" width="14" height="2" rx="1" fill="#d0e0f4" />
    </svg>
  )
}

function FolderCircle({ open = false }) {
  const front = open ? '#f5c233' : '#fad04a'
  const tab   = open ? '#c98e18' : '#d9a020'
  return (
    <svg width="42" height="42" viewBox="0 0 48 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="0" y="11" width="48" height="30" rx="4" fill={tab} />
      <path d="M2 11 L2 7 Q2 4 5 4 L19 4 Q22 4 23.5 7 L26 11 Z" fill={tab} />
      <rect x="0" y="17" width="48" height="24" rx="4" fill={front} />
      <rect x="0" y="17" width="48" height="5" rx="3" fill="rgba(255,255,255,0.22)" />
      {open && <rect x="11" y="14" width="18" height="6" rx="2" fill="rgba(255,255,255,0.75)" />}
    </svg>
  )
}

// ── Group Doc Detail ──────────────────────────────────────────────────────────
function GroupDocDetail({ doc, isAdmin, onDelete, onBack, onToggleHidden, onToggleArchived }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const recordId = doc.id
  const isDemoDoc = String(recordId || '').startsWith('demo-')
  const fileName = doc.file_name || doc.document_name || 'download'
  const type     = doc.file_type || 'other'
  const sizeKb   = doc.file_size_kb
  const ext      = getFileExt(fileName)
  const hasFile  = !isDemoDoc && !!doc.storage_path
  const canInlinePreview = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
  const canDocxPreview = ext === 'docx'   // converted to HTML server-side via mammoth
  const canPreview = canInlinePreview || canDocxPreview

  function getDownloadUrl(inline = false) {
    return `/api/group-docs/download?id=${recordId}${inline ? '&inline=1' : ''}`
  }

  function handlePreview() {
    if (!hasFile) return
    if (canDocxPreview) {
      setPreviewUrl(`${window.location.origin}/api/group-docs/preview-docx?id=${recordId}`)
    } else {
      // Same-origin inline URL renders directly in the iframe (the auth cookie is sent).
      setPreviewUrl(`${window.location.origin}${getDownloadUrl(true)}`)
    }
  }

  function handleDownload() {
    if (!hasFile) return
    const a = document.createElement('a')
    a.href = getDownloadUrl(false)   // attachment disposition → saves the file
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function handleOpenNewTab() {
    if (!hasFile) return
    window.open(getDownloadUrl(true), '_blank')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* Section label */}
      <div style={{
        fontSize: 12, color: '#888', background: '#f5f8ff',
        padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4',
      }}>
        Document Details
      </div>

      <div style={{ padding: '16px 16px 24px' }}>
        {/* Type icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <DocTypeIcon type={type} />
          {ext && (
            <span style={{
              background: '#e8f0fb', color: '#1a56a0', borderRadius: 4,
              padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>
              {ext.toUpperCase()}
            </span>
          )}
        </div>

        {/* Name */}
        <div style={{
          fontSize: 16, fontWeight: 600, color: '#1a56a0',
          marginBottom: 16, lineHeight: 1.4,
        }}>
          {doc.document_name}
        </div>

        {/* Meta fields */}
        {[
          ['Folder', [doc.folder_name, doc.subfolder_name].filter(Boolean).join(' / ')],
          ['File Size', sizeKb ? formatSize(sizeKb) : null],
          ['File Name', fileName],
        ].filter(([, v]) => v).map(([label, value]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a56a0', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{
              fontSize: 14, color: '#1a56a0',
              borderBottom: '2px solid #1a56a0',
              padding: '4px 0',
            }}>
              {value}
            </div>
          </div>
        ))}

        {/* File actions */}
        {hasFile ? (
          <>
            {canPreview && (
              <button
                onClick={handlePreview}
                style={{
                  width: '100%', padding: '13px 0', marginTop: 8,
                  background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  marginBottom: 8, fontFamily: 'Segoe UI, sans-serif',
                }}
              >
                Preview {ext ? ext.toUpperCase() : 'Document'}
              </button>
            )}
            <button
              onClick={handleDownload}
              style={{
                width: '100%', padding: '13px 0', marginTop: canPreview ? 0 : 8,
                background: canPreview ? '#fff' : '#1a56a0',
                color: canPreview ? '#1a56a0' : '#fff',
                border: canPreview ? '1.5px solid #1a56a0' : 'none', borderRadius: 6,
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                marginBottom: 8, fontFamily: 'Segoe UI, sans-serif',
              }}
            >
              {'⬇'} Download {ext ? ext.toUpperCase() : 'File'}
            </button>
            <button
              onClick={handleOpenNewTab}
              style={{
                width: '100%', padding: '10px 0',
                background: '#fff', color: '#1a56a0',
                border: '1.5px solid #1a56a0', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                marginBottom: 12, fontFamily: 'Segoe UI, sans-serif',
              }}
            >
              Open in New Tab
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#b02020', background: '#fde8e8', borderRadius: 6, padding: '10px 12px', marginTop: 8, marginBottom: 12 }}>
            No file is attached to this record.
          </div>
        )}

        {/* Hide / Archive — admin only */}
        {isAdmin && (onToggleHidden || onToggleArchived) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {onToggleHidden && (
              <button onClick={() => onToggleHidden(doc)}
                style={{ flex: 1, padding: '10px 0', background: '#fdf3d0', color: '#8a6d00', border: '1.5px solid #e8d58a', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
                {doc.is_hidden ? '👁 Unhide' : '🙈 Hide from Members'}
              </button>
            )}
            {onToggleArchived && (
              <button onClick={() => onToggleArchived(doc)}
                style={{ flex: 1, padding: '10px 0', background: '#eceff2', color: '#5a5a5a', border: '1.5px solid #cfd6dd', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
                {doc.is_archived ? '♻ Unarchive' : '🗄 Archive'}
              </button>
            )}
          </div>
        )}

        {/* Delete — admin only */}
        {isAdmin && (
          <button
            onClick={() => {
              if (!confirm(`Delete "${doc.document_name}"? This cannot be undone.`)) return
              onDelete(recordId)
              onBack()
            }}
            style={{
              width: '100%', padding: '10px 0',
              background: '#fde8e8', color: '#b02020',
              border: '1.5px solid #f5b3b3', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            {'🗑'} Delete Document
          </button>
        )}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', background: '#1a56a0',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.document_name}
            </span>
            <button
              onClick={() => setPreviewUrl(null)}
              style={{
                background: 'none', border: '1.5px solid rgba(255,255,255,0.5)',
                borderRadius: 4, color: '#fff', fontSize: 18, padding: '2px 10px',
                cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', flexShrink: 0,
              }}
            >
              {'✕'}
            </button>
          </div>
          <iframe
            src={previewUrl}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, border: 'none', background: '#fff' }}
            title={`Preview: ${doc.document_name}`}
          />
        </div>
      )}
    </div>
  )
}

// ── Doc Row ───────────────────────────────────────────────────────────────────
function StatusPill({ label, color, bg }) {
  return (
    <span style={{ background: bg, color, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
      {label}
    </span>
  )
}

function DocRow({ doc, isAdmin, onDelete, onSelect, indent = false, isInSubfolder = false, hasSubfolders = false, onMoveUp, onMoveDown, onToggleHidden, onToggleArchived, draggable = false, onDragStartDoc }) {
  const type     = doc.file_type || 'other'
  const sizeKb   = doc.file_size_kb
  const hidden   = !!doc.is_hidden
  const archived = !!doc.is_archived

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartDoc?.(doc) } : undefined}
      onDragEnd={draggable ? () => onDragStartDoc?.(null) : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1.5px solid #d0e0f4', background: '#fff',
        opacity: hidden ? 0.55 : 1,
        cursor: draggable ? 'grab' : 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      <button
        onClick={() => onSelect(doc)}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: `12px 16px 12px ${indent ? 28 : 16}px`,
          background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', minWidth: 0,
        }}
      >
        <DocTypeIcon type={type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Segoe UI, sans-serif' }}>
              {doc.document_name}
            </span>
            {hidden && <StatusPill label="HIDDEN" color="#8a6d00" bg="#fdf3d0" />}
            {archived && <StatusPill label="ARCHIVED" color="#5a5a5a" bg="#eceff2" />}
          </div>
          {sizeKb ? (
            <div style={{ fontSize: 13, color: '#5580a0', marginTop: 2 }}>{formatSize(sizeKb)}</div>
          ) : null}
        </div>
        <span style={{ color: '#1a56a0', fontSize: 20, flexShrink: 0 }}>{'›'}</span>
      </button>
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 12, flexShrink: 0 }}>
          {isInSubfolder && onMoveUp && (
            <button onClick={e => { e.stopPropagation(); onMoveUp(doc) }}
              title="Move up a level"
              style={{ padding: '4px 6px', background: '#e8f0fb', border: '1px solid #b3caf0', borderRadius: 4, fontSize: 12, color: '#1a56a0', cursor: 'pointer', fontWeight: 600 }}>
              ⬆
            </button>
          )}
          {hasSubfolders && onMoveDown && (
            <button onClick={e => { e.stopPropagation(); onMoveDown(doc) }}
              title="Move to subfolder"
              style={{ padding: '4px 6px', background: '#e8f0fb', border: '1px solid #b3caf0', borderRadius: 4, fontSize: 12, color: '#1a56a0', cursor: 'pointer', fontWeight: 600 }}>
              ⬇
            </button>
          )}
          {onToggleHidden && (
            <button onClick={e => { e.stopPropagation(); onToggleHidden(doc) }}
              title={hidden ? 'Unhide (show to members)' : 'Hide from members'}
              style={{ padding: '4px 6px', background: '#fdf3d0', border: '1px solid #e8d58a', borderRadius: 4, fontSize: 12, color: '#8a6d00', cursor: 'pointer' }}>
              {hidden ? '🙈' : '👁'}
            </button>
          )}
          {onToggleArchived && (
            <button onClick={e => { e.stopPropagation(); onToggleArchived(doc) }}
              title={archived ? 'Unarchive' : 'Archive'}
              style={{ padding: '4px 6px', background: '#eceff2', border: '1px solid #cfd6dd', borderRadius: 4, fontSize: 12, color: '#5a5a5a', cursor: 'pointer' }}>
              {archived ? '♻' : '🗄'}
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); if (confirm('Delete this document?')) onDelete(doc.id) }}
            title="Delete"
            style={{ padding: '4px 6px', background: '#fde8e8', border: '1px solid #f5b3b3', borderRadius: 4, fontSize: 12, color: '#b02020', cursor: 'pointer' }}>
            🗑
          </button>
        </div>
      )}
    </div>
  )
}

// ── Search Doc Row ────────────────────────────────────────────────────────────
function SearchDocRow({ doc, onSelect }) {
  const type = doc.file_type || 'other'

  return (
    <button
      onClick={() => onSelect(doc)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: '#fff',
        border: 'none', borderBottom: '1.5px solid #d0e0f4',
        cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      <DocTypeIcon type={type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Segoe UI, sans-serif' }}>
          {doc.document_name}
        </div>
        <div style={{ fontSize: 13, color: '#5580a0', marginTop: 2 }}>
          <span style={{ background: '#e8f0fb', color: '#1a56a0', borderRadius: 4, padding: '1px 6px', fontWeight: 600, marginRight: 6, fontSize: 11 }}>
            {doc.group_name || 'All Staff'}
          </span>
          {[doc.folder_name, doc.subfolder_name].filter(Boolean).join(' / ')}
        </div>
      </div>
      <span style={{ color: '#1a56a0', fontSize: 20, flexShrink: 0 }}>{'›'}</span>
    </button>
  )
}

// ── Name Modal ────────────────────────────────────────────────────────────────
function NameModal({ title, placeholder, onConfirm, onCancel }) {
  const [value, setValue] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a56a0', marginBottom: 14 }}>{title}</div>
        <input
          autoFocus value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()) }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 0', fontSize: 14, color: '#1a56a0', border: 'none', borderBottom: '2px solid #1a56a0', outline: 'none', marginBottom: 20, fontFamily: 'Segoe UI, sans-serif' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', background: '#fff', border: '1.5px solid #d0e0f4', borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#5580a0' }}>Cancel</button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} style={{ flex: 1, padding: '11px', background: '#1a56a0', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#fff' }}>Create</button>
        </div>
      </div>
    </div>
  )
}

// ── Document tile (grid card) ─────────────────────────────────────────────────
function DocTile({ doc, isAdmin, onSelect, onDelete, onToggleHidden, onToggleArchived, draggable, onDragStartDoc }) {
  const type     = doc.file_type || 'other'
  const hidden   = !!doc.is_hidden
  const archived = !!doc.is_archived
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartDoc?.(doc) } : undefined}
      onDragEnd={draggable ? () => onDragStartDoc?.(null) : undefined}
      onClick={() => onSelect(doc)}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 10px 12px', border: '1.5px solid #d0e0f4', borderRadius: 8, background: '#fff',
        cursor: draggable ? 'grab' : 'pointer', textAlign: 'center', minWidth: 0, opacity: hidden ? 0.55 : 1,
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      <DocTypeIcon type={type} />
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a56a0', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3, wordBreak: 'break-word' }}>
        {doc.document_name}
      </div>
      {(hidden || archived) && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {hidden && <StatusPill label="HIDDEN" color="#8a6d00" bg="#fdf3d0" />}
          {archived && <StatusPill label="ARCHIVED" color="#5a5a5a" bg="#eceff2" />}
        </div>
      )}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          {onToggleHidden && (
            <button onClick={e => { e.stopPropagation(); onToggleHidden(doc) }} title={hidden ? 'Unhide' : 'Hide from members'}
              style={{ padding: '3px 6px', background: '#fdf3d0', border: '1px solid #e8d58a', borderRadius: 4, fontSize: 11, color: '#8a6d00', cursor: 'pointer' }}>{hidden ? '🙈' : '👁'}</button>
          )}
          {onToggleArchived && (
            <button onClick={e => { e.stopPropagation(); onToggleArchived(doc) }} title={archived ? 'Unarchive' : 'Archive'}
              style={{ padding: '3px 6px', background: '#eceff2', border: '1px solid #cfd6dd', borderRadius: 4, fontSize: 11, color: '#5a5a5a', cursor: 'pointer' }}>{archived ? '♻' : '🗄'}</button>
          )}
          <button onClick={e => { e.stopPropagation(); if (confirm('Delete this document?')) onDelete(doc.id) }} title="Delete"
            style={{ padding: '3px 6px', background: '#fde8e8', border: '1px solid #f5b3b3', borderRadius: 4, fontSize: 11, color: '#b02020', cursor: 'pointer' }}>🗑</button>
        </div>
      )}
    </div>
  )
}

function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0, border: '1.5px solid #1a56a0', borderRadius: 5, overflow: 'hidden' }}>
      {['grid', 'list'].map(v => (
        <button key={v} onClick={() => setView(v)}
          title={v === 'grid' ? 'Grid view' : 'List view'}
          style={{ padding: '3px 9px', background: view === v ? '#1a56a0' : '#fff', color: view === v ? '#fff' : '#1a56a0', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Segoe UI, sans-serif' }}>
          {v === 'grid' ? '▦' : '☰'}
        </button>
      ))}
    </div>
  )
}

// ── Desktop Explorer (full-page two-pane) ─────────────────────────────────────
// Left: root folders. Right: selected folder's subfolders + docs as a grid (or
// list). Click a subfolder to drill in. Drag docs onto any folder/subfolder (or
// the folder-root zone) to move them.
function DesktopExplorer({
  folderTree, ungroupedDocs, groupName, isAdmin,
  selectedFolder, setSelectedFolder,
  draggingDoc, setDraggingDoc, dragOverKey, setDragOverKey, onDropMove,
  onSelectDoc, onDeleteDoc, onToggleHidden, onToggleArchived,
  onAddFolder, onAddSubfolder, onUpload,
}) {
  const rootUploadRef = useRef()
  const [view, setView]         = useState('grid')   // 'grid' | 'list'
  const [subDrill, setSubDrill] = useState(null)      // subfolder name currently drilled into

  const dropTargetStyle = (key) => ({
    background: dragOverKey === key ? '#dcebff' : undefined,
    outline: dragOverKey === key ? '2px dashed #1a56a0' : 'none',
    outlineOffset: -2,
  })
  const allow = (key) => (e) => { e.preventDefault(); if (dragOverKey !== key) setDragOverKey(key) }
  const clearOver = () => setDragOverKey(null)
  const endDrag = () => { setDraggingDoc(null); setDragOverKey(null) }
  const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, padding: 16, alignContent: 'start' }

  const ungroupedFld = { name: '__ungrouped__', rootDocs: ungroupedDocs, subfolders: [] }
  // Default the right pane to the Unfiled documents when nothing is explicitly
  // selected, so opening My Docs shows the loose files full-width on the right.
  const fld = selectedFolder
    ? (selectedFolder.name === '__ungrouped__'
        ? ungroupedFld
        : folderTree.find(f => f.name === selectedFolder.name))
    : (ungroupedDocs.length > 0 ? ungroupedFld : null)

  // Selecting a folder resets the drill-in subfolder. The parent only ever
  // clears the selection (group switch → null), so this handler covers every
  // folder change; a null fld already yields no drillSub below.
  const selectFolder = (f) => { setSelectedFolder(f); setSubDrill(null) }

  // Subfolder currently drilled into (live docs)
  const drillSub = fld && subDrill ? fld.subfolders.find(s => s.name === subDrill) : null

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, fontFamily: 'Segoe UI, sans-serif' }}>
      {/* LEFT: root folders */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1.5px solid #d0e0f4', overflowY: 'auto', background: '#fff' }}>
        <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '8px 16px', borderBottom: '1.5px solid #d0e0f4', fontWeight: 600 }}>
          {groupName} · {folderTree.length} folder{folderTree.length !== 1 ? 's' : ''}
        </div>
        {folderTree.map(folder => {
          const total = folder.rootDocs.length + folder.subfolders.reduce((a, s) => a + s.docs.length, 0)
          const key = `folder:${folder.name}`
          const active = selectedFolder?.name === folder.name
          return (
            <div key={folder.name}
              onClick={() => selectFolder(folder)}
              onDragOver={draggingDoc ? allow(key) : undefined}
              onDragLeave={clearOver}
              onDrop={draggingDoc ? (e) => { e.preventDefault(); onDropMove(draggingDoc, folder.name, ''); endDrag() } : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer',
                background: active ? '#e8f0fb' : '#fff',
                borderLeft: active ? '4px solid #1a56a0' : '4px solid transparent',
                ...dropTargetStyle(key),
              }}
            >
              <FolderCircle open={active} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a56a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</div>
                <div style={{ fontSize: 12, color: '#5580a0', marginTop: 1 }}>
                  {folder.subfolders.length > 0 && `${folder.subfolders.length} sub · `}{total} doc{total !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )
        })}
        {ungroupedDocs.length > 0 && (
          <div onClick={() => selectFolder(ungroupedFld)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer',
              background: (selectedFolder?.name === '__ungrouped__' || !selectedFolder) ? '#e8f0fb' : '#fff',
              borderLeft: (selectedFolder?.name === '__ungrouped__' || !selectedFolder) ? '4px solid #1a56a0' : '4px solid transparent',
            }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#5580a0' }}>Unfiled ({ungroupedDocs.length})</div>
          </div>
        )}
        {isAdmin && (
          <div style={{ padding: '10px 16px' }}>
            <button onClick={onAddFolder}
              style={{ width: '100%', padding: '9px', background: '#fff', border: '1.5px dashed #1a56a0', borderRadius: 4, fontSize: 13, color: '#1a56a0', fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
              + Add Folder
            </button>
          </div>
        )}
        {folderTree.length === 0 && ungroupedDocs.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No folders yet</div>
        )}
      </div>

      {/* RIGHT: selected folder contents */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {!fld ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
            Select a folder on the left{isAdmin ? ', or drag a document onto a folder to move it.' : '.'}
          </div>
        ) : (
          <>
            {/* Header: breadcrumb / folder-root drop zone + view toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f8ff', borderBottom: '1.5px solid #d0e0f4', padding: '8px 16px' }}>
              {drillSub ? (
                <button
                  onClick={() => setSubDrill(null)}
                  onDragOver={draggingDoc ? allow('root') : undefined}
                  onDragLeave={clearOver}
                  onDrop={draggingDoc ? (e) => { e.preventDefault(); onDropMove(draggingDoc, fld.name, ''); setSubDrill(null); endDrag() } : undefined}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#1a56a0', fontFamily: 'Segoe UI, sans-serif', textAlign: 'left', ...dropTargetStyle('root') }}>
                  <span style={{ fontSize: 16 }}>‹</span> {fld.name} <span style={{ color: '#5580a0', fontWeight: 400 }}>/ {drillSub.name}</span>
                  {draggingDoc && <span style={{ fontWeight: 400, color: '#5580a0', fontSize: 12 }}>· drop to move up</span>}
                </button>
              ) : (
                <div
                  onDragOver={draggingDoc && fld.name !== '__ungrouped__' ? allow('root') : undefined}
                  onDragLeave={clearOver}
                  onDrop={draggingDoc && fld.name !== '__ungrouped__' ? (e) => { e.preventDefault(); onDropMove(draggingDoc, fld.name, ''); endDrag() } : undefined}
                  style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#1a56a0', borderRadius: 4, padding: '2px 4px', ...dropTargetStyle('root') }}>
                  {fld.name === '__ungrouped__' ? 'Unfiled documents' : fld.name}
                  {draggingDoc && fld.name !== '__ungrouped__' && (
                    <span style={{ fontWeight: 400, color: '#5580a0', marginLeft: 8, fontSize: 12 }}>drop here for folder top level</span>
                  )}
                </div>
              )}
              <ViewToggle view={view} setView={setView} />
            </div>

            {/* Admin add bar */}
            {isAdmin && fld.name !== '__ungrouped__' && (
              <div style={{ padding: '8px 16px', borderBottom: '1.5px solid #d0e0f4', background: '#f5f8ff', display: 'flex', gap: 8 }}>
                {!drillSub && (
                  <button onClick={() => onAddSubfolder(fld.name)}
                    style={{ flex: 1, padding: '8px', background: '#fff', border: '1.5px dashed #1a56a0', borderRadius: 4, fontSize: 13, color: '#1a56a0', fontWeight: 600, cursor: 'pointer' }}>
                    + Add Subfolder
                  </button>
                )}
                <input ref={rootUploadRef} type="file" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], fld.name, drillSub ? drillSub.name : ''); e.target.value = '' }} />
                <button onClick={() => rootUploadRef.current?.click()}
                  style={{ flex: 1, padding: '8px', background: '#fff', border: '1.5px dashed #1a56a0', borderRadius: 4, fontSize: 13, color: '#1a56a0', fontWeight: 600, cursor: 'pointer' }}>
                  + Upload to {drillSub ? drillSub.name : 'Folder'}
                </button>
              </div>
            )}

            {/* Content: grid or list */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {drillSub ? (
                drillSub.docs.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No documents in this subfolder</div>
                ) : view === 'grid' ? (
                  <div style={GRID}>
                    {drillSub.docs.map(doc => (
                      <DocTile key={doc.id} doc={doc} isAdmin={isAdmin}
                        onSelect={onSelectDoc} onDelete={onDeleteDoc}
                        onToggleHidden={isAdmin ? onToggleHidden : undefined} onToggleArchived={isAdmin ? onToggleArchived : undefined}
                        draggable={isAdmin} onDragStartDoc={setDraggingDoc} />
                    ))}
                  </div>
                ) : (
                  drillSub.docs.map(doc => (
                    <DocRow key={doc.id} doc={doc} isAdmin={isAdmin}
                      onDelete={onDeleteDoc} onSelect={onSelectDoc} isInSubfolder
                      onToggleHidden={isAdmin ? onToggleHidden : undefined} onToggleArchived={isAdmin ? onToggleArchived : undefined}
                      draggable={isAdmin} onDragStartDoc={setDraggingDoc} />
                  ))
                )
              ) : (fld.subfolders.length === 0 && fld.rootDocs.length === 0) ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>This folder is empty</div>
              ) : view === 'grid' ? (
                <div style={GRID}>
                  {fld.subfolders.map(sf => {
                    const key = `sub:${fld.name}::${sf.name}`
                    return (
                      <div key={sf.name}
                        onClick={() => setSubDrill(sf.name)}
                        onDragOver={draggingDoc ? allow(key) : undefined}
                        onDragLeave={clearOver}
                        onDrop={draggingDoc ? (e) => { e.preventDefault(); onDropMove(draggingDoc, fld.name, sf.name); endDrag() } : undefined}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 10px 12px', border: '1.5px solid #d0e0f4', borderRadius: 8, background: '#fffdf5', cursor: 'pointer', textAlign: 'center', ...dropTargetStyle(key) }}>
                        <FolderCircle />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a56a0', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sf.name}</div>
                        <div style={{ fontSize: 12, color: '#5580a0' }}>{sf.docs.length} doc{sf.docs.length !== 1 ? 's' : ''}</div>
                      </div>
                    )
                  })}
                  {fld.rootDocs.map(doc => (
                    <DocTile key={doc.id} doc={doc} isAdmin={isAdmin}
                      onSelect={onSelectDoc} onDelete={onDeleteDoc}
                      onToggleHidden={isAdmin ? onToggleHidden : undefined} onToggleArchived={isAdmin ? onToggleArchived : undefined}
                      draggable={isAdmin} onDragStartDoc={setDraggingDoc} />
                  ))}
                </div>
              ) : (
                <>
                  {fld.subfolders.map(sf => {
                    const key = `sub:${fld.name}::${sf.name}`
                    return (
                      <div key={sf.name}
                        onClick={() => setSubDrill(sf.name)}
                        onDragOver={draggingDoc ? allow(key) : undefined}
                        onDragLeave={clearOver}
                        onDrop={draggingDoc ? (e) => { e.preventDefault(); onDropMove(draggingDoc, fld.name, sf.name); endDrag() } : undefined}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer', background: '#fffdf5', ...dropTargetStyle(key) }}>
                        <FolderCircle />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a56a0' }}>{sf.name}</div>
                          <div style={{ fontSize: 12, color: '#5580a0', marginTop: 1 }}>{sf.docs.length} doc{sf.docs.length !== 1 ? 's' : ''}</div>
                        </div>
                        <span style={{ color: '#1a56a0', fontSize: 18 }}>{'›'}</span>
                      </div>
                    )
                  })}
                  {fld.rootDocs.map(doc => (
                    <DocRow key={doc.id} doc={doc} isAdmin={isAdmin}
                      onDelete={onDeleteDoc} onSelect={onSelectDoc}
                      onToggleHidden={isAdmin ? onToggleHidden : undefined} onToggleArchived={isAdmin ? onToggleArchived : undefined}
                      draggable={isAdmin} onDragStartDoc={setDraggingDoc} />
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MyDocsClient({
  appIcon = '', appName = '',
  userEmail = null, userRole = null, facilityId = null,
  initialMemberships = [],
  initialGroups = [], initialDocuments = [],
}) {
  const [selectedGroupId, setSelectedGroupId]     = useState(ALL_STAFF_ID)
  const [search, setSearch]                       = useState('')
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false)
  const [documents, setDocuments]                 = useState(initialDocuments)
  // localFolders: { groupId, folderName, subfolderName } — client-side empty folders
  const [localFolders, setLocalFolders]           = useState([])
  const [modal, setModal]                         = useState(null)
  const [toast, setToast]                         = useState(null)
  const [uploadingKey, setUploadingKey]           = useState(null)
  const [selectedDocId, setSelectedDocId]         = useState(null) // open document (derived below)
  const [moveDownTarget, setMoveDownTarget]       = useState(null) // { doc, folderName, subfolders }
  const [selectedFolderName, setSelectedFolderName] = useState(null) // folder (derived from folderTree below)
  const [selectedSubfolder, setSelectedSubfolder] = useState(null) // subfolder name
  const quickUploadRef = useRef()
  const [isWide, setIsWide]               = useState(false)
  const [showArchived, setShowArchived]   = useState(false)
  const [draggingDoc, setDraggingDoc]     = useState(null)
  const [dragOverKey, setDragOverKey]     = useState(null)

  const memberships = initialMemberships
  const isSuperUser = userRole === 'super_user'
  const isDemo      = userRole === 'demo'

  // Detect full-page (wide) viewport → two-pane explorer; phone width keeps single column
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const apply = () => setIsWide(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Demo accounts browse the placeholder documents but can't change anything.
  function demoGuard() {
    if (!isDemo) return false
    showToast('Demo mode — changes are disabled.')
    return true
  }

  const myGroups = useMemo(() => {
    const memberMap = new Map(memberships.map(m => [m.group_id, m]))
    const visibleGroups = isSuperUser ? initialGroups : initialGroups.filter(g => memberMap.has(g.id))
    return [
      { id: ALL_STAFF_ID, group_name: 'All Staff', isDefault: true, isAdmin: isSuperUser },
      ...visibleGroups.map(g => {
        const m = memberMap.get(g.id)
        return { ...g, isAdmin: isSuperUser || !!m?.is_admin }
      }),
    ]
  }, [initialGroups, memberships, isSuperUser])

  const selectedGroup = myGroups.find(g => g.id === selectedGroupId)
  const isAdmin = selectedGroup?.isAdmin || false

  // Per-group admin set (mirrors `isAdmin` but for cross-group search filtering)
  const adminGroupIds = useMemo(() => {
    const s = new Set()
    memberships.forEach(m => { if (m.is_admin) s.add(m.group_id) })
    return s
  }, [memberships])
  function canAdminGroup(gid) {
    if (isSuperUser) return true
    if (gid === ALL_STAFF_ID) return false
    return adminGroupIds.has(gid)
  }

  // Filter documents for selected group (apply hidden/archived curation rules)
  const groupDocs = useMemo(() => {
    return documents.filter(d => {
      if (docGid(d) !== selectedGroupId) return false
      if (d.is_active === false) return false
      if (d.is_hidden && !isAdmin) return false          // hidden = members can't see it
      if (d.is_archived && !showArchived) return false     // archived = behind View Archived
      return true
    })
  }, [documents, selectedGroupId, isAdmin, showArchived])

  // Build folder tree from flat documents
  const { folderTree, ungroupedDocs } = useMemo(() => {
    const folderMap = {}
    const ungrouped = []

    // Add local (empty) folders for this group
    localFolders
      .filter(lf => lf.groupId === selectedGroupId && lf.folderName)
      .forEach(lf => {
        if (!folderMap[lf.folderName]) folderMap[lf.folderName] = { subfolderMap: {}, rootDocs: [] }
        if (lf.subfolderName && !folderMap[lf.folderName].subfolderMap[lf.subfolderName]) {
          folderMap[lf.folderName].subfolderMap[lf.subfolderName] = []
        }
      })

    groupDocs.forEach(doc => {
      const fn = (doc.folder_name || '').trim()
      const sfn = (doc.subfolder_name || '').trim()
      if (!fn) { ungrouped.push(doc); return }
      if (!folderMap[fn]) folderMap[fn] = { subfolderMap: {}, rootDocs: [] }
      if (sfn) {
        if (!folderMap[fn].subfolderMap[sfn]) folderMap[fn].subfolderMap[sfn] = []
        folderMap[fn].subfolderMap[sfn].push(doc)
      } else {
        folderMap[fn].rootDocs.push(doc)
      }
    })

    const tree = Object.entries(folderMap).map(([name, { subfolderMap, rootDocs }]) => ({
      name,
      rootDocs,
      subfolders: Object.entries(subfolderMap).map(([sname, docs]) => ({ name: sname, docs })),
    })).sort((a, b) => a.name.localeCompare(b.name))

    return { folderTree: tree, ungroupedDocs: ungrouped }
  }, [groupDocs, localFolders, selectedGroupId])

  const totalDocs = ungroupedDocs.length + folderTree.reduce((a, f) =>
    a + f.rootDocs.length + f.subfolders.reduce((b, s) => b + s.docs.length, 0), 0)

  // The open folder is derived from the live folderTree, so it stays in sync
  // through mutations (a deleted/renamed folder simply resolves to null).
  const selectedFolder = useMemo(() => {
    if (!selectedFolderName) return null
    if (selectedFolderName === '__ungrouped__') return { name: '__ungrouped__', rootDocs: ungroupedDocs, subfolders: [] }
    return folderTree.find(f => f.name === selectedFolderName) || null
  }, [selectedFolderName, folderTree, ungroupedDocs])
  const openFolder = (f) => setSelectedFolderName(f ? f.name : null)

  // Likewise the open document: derived from `documents`, so hide/archive
  // toggles are reflected immediately and a deleted doc closes the detail view.
  const selectedDoc = useMemo(
    () => (selectedDocId ? documents.find(d => d.id === selectedDocId) || null : null),
    [documents, selectedDocId]
  )
  const openDoc = (doc) => setSelectedDocId(doc.id)

  const searchResults = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    const memberGroupIds = new Set(memberships.map(m => m.group_id))
    return documents.filter(d => {
      if (d.is_active === false) return false
      const gid = docGid(d)
      if (gid !== ALL_STAFF_ID && !isSuperUser && !memberGroupIds.has(gid)) return false
      if (d.is_hidden && !canAdminGroup(gid)) return false
      if (d.is_archived && !showArchived) return false
      return (d.document_name || '').toLowerCase().includes(q)
    })
  }, [search, documents, memberships, isSuperUser, adminGroupIds, showArchived]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ─────────────────────────────────────────────────────────────

  // Update a document row and confirm a row was actually written. Under RLS a
  // denied update is NOT an error — the policy just filters the row out and
  // zero rows change — so `.select('id')` is what distinguishes "saved" from
  // "silently ignored". Returns an error message, or null on success.
  async function updateDoc(id, patch) {
    const { data, error } = await supabase
      .from('biz_group_documents')
      .update(patch)
      .eq('id', id)
      .select('id')
    if (error) return writeError(error)
    if (!data || data.length === 0) return 'you do not have permission for this group'
    return null
  }

  // Insert the document row first (RLS is the permission gate), then put the
  // bytes in Storage — whose insert policy only accepts an object whose path
  // points at a row this caller could write. A failed byte upload rolls the
  // row back so no phantom document lingers.
  async function handleUpload(file, folderName, subfolderName) {
    if (demoGuard()) return
    if (!facilityId) { showToast('Upload failed: no facility.'); return }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.has(ext)) { showToast(`Upload failed: file type .${ext} not allowed.`); return }
    if (file.size > MAX_FILE_SIZE) { showToast('Upload failed: file exceeds 25 MB limit.'); return }

    const gname = selectedGroup?.group_name || 'All Staff'
    const key = subfolderName ? `${folderName}::${subfolderName}` : (folderName || 'root')
    setUploadingKey(key)

    let fileType = 'other'
    if (ext === 'pdf') fileType = 'pdf'
    else if (['doc', 'docx'].includes(ext)) fileType = 'docx'
    else if (['xls', 'xlsx'].includes(ext)) fileType = 'xlsx'
    else if (['ppt', 'pptx'].includes(ext)) fileType = 'pptx'
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) fileType = 'img'

    // Storage keys reject some characters filenames may carry; the display
    // name keeps the original.
    const id = crypto.randomUUID()
    const safeName = (file.name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 180) || `file.${ext}`
    const storagePath = `${facilityId}/${id}/${safeName}`

    const row = {
      id,
      facility_id: facilityId,
      group_id: selectedGroupId === ALL_STAFF_ID ? null : selectedGroupId,
      group_name: gname,
      folder_name: folderName || '',
      subfolder_name: subfolderName || '',
      document_name: file.name,
      file_name: file.name,
      file_type: fileType,
      file_size_kb: Math.round(file.size / 1024) || 1,
      mime_type: file.type || 'application/octet-stream',
      storage_path: storagePath,
      uploaded_by: userEmail,
    }

    const { data: doc, error: insertError } = await supabase
      .from('biz_group_documents')
      .insert(row)
      .select()
      .single()
    if (insertError) {
      setUploadingKey(null)
      showToast(`Upload failed: ${writeError(insertError)}.`)
      return
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: row.mime_type, upsert: false })
    if (uploadError) {
      await supabase.from('biz_group_documents').delete().eq('id', id)
      setUploadingKey(null)
      showToast(`Upload failed: ${uploadError.message}`)
      return
    }

    setUploadingKey(null)
    setDocuments(d => [doc, ...d])
    // Remove local folder placeholder now that a doc exists
    if (folderName) {
      setLocalFolders(lf => lf.filter(x => !(x.groupId === selectedGroupId && x.folderName === folderName && x.subfolderName === (subfolderName || ''))))
    }
    showToast(`"${file.name}" uploaded.`)
  }

  async function handleDeleteDoc(id) {
    if (demoGuard()) return
    // Soft delete — the row (and file) stay behind is_active for recovery.
    const err = await updateDoc(id, { is_active: false })
    if (err) {
      showToast(`Delete failed: ${err}`)
      return
    }
    setDocuments(prev => prev.filter(x => x.id !== id))
    // If folder is now empty, keep it visible via localFolders
    const deletedDoc = documents.find(x => x.id === id)
    if (deletedDoc?.folder_name) {
      const fn = deletedDoc.folder_name
      const sfn = deletedDoc.subfolder_name || ''
      const remaining = documents.filter(d => d.id !== id && docGid(d) === selectedGroupId && d.is_active !== false && d.folder_name === fn && (d.subfolder_name || '') === sfn)
      if (remaining.length === 0) {
        setLocalFolders(lf => [...lf, { groupId: selectedGroupId, folderName: fn, subfolderName: sfn }])
      }
    }
    showToast('Document removed.')
  }

  function handleDeleteFolder(folderName) {
    setLocalFolders(lf => lf.filter(x => !(x.groupId === selectedGroupId && x.folderName === folderName)))
    showToast(`Folder "${folderName}" deleted.`)
  }

  function handleDeleteSubfolder(folderName, subfolderName) {
    setLocalFolders(lf => lf.filter(x => !(x.groupId === selectedGroupId && x.folderName === folderName && x.subfolderName === subfolderName)))
    showToast(`Subfolder "${subfolderName}" deleted.`)
  }

  async function handleMoveDocUp(doc) {
    if (demoGuard()) return
    // Move doc from subfolder to parent folder (clear subfolder name)
    const err = await updateDoc(doc.id, { subfolder_name: '' })
    if (err) {
      showToast(`Move failed: ${err}`)
      return
    }
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, subfolder_name: '' } : d
    ))
    showToast('Moved to parent folder.')
  }

  async function handleMoveDocDown(doc, targetSubfolder) {
    if (demoGuard()) return
    const err = await updateDoc(doc.id, { subfolder_name: targetSubfolder })
    if (err) {
      showToast(`Move failed: ${err}`)
      return
    }
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, subfolder_name: targetSubfolder } : d
    ))
    setMoveDownTarget(null)
    showToast(`Moved to "${targetSubfolder}".`)
  }

  async function toggleFlag(doc, field, next, okMsg) {
    if (demoGuard()) return
    const err = await updateDoc(doc.id, { [field]: next })
    if (err) {
      showToast(`Failed: ${err}`)
      return
    }
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, [field]: next } : d))
    showToast(okMsg)
  }
  const handleToggleHidden   = (doc) => toggleFlag(doc, 'is_hidden', !doc.is_hidden, !doc.is_hidden ? 'Document hidden from members.' : 'Document is visible again.')
  const handleToggleArchived = (doc) => toggleFlag(doc, 'is_archived', !doc.is_archived, !doc.is_archived ? 'Document archived.' : 'Document restored from archive.')

  // Unified drag-drop move: drop a doc onto a folder/subfolder target
  async function handleDropMove(doc, folderName, subfolderName) {
    if (demoGuard()) return
    if (!doc) return
    const fn = folderName || ''
    const sfn = subfolderName || ''
    if ((doc.folder_name || '') === fn && (doc.subfolder_name || '') === sfn) return // no-op
    const err = await updateDoc(doc.id, { folder_name: fn, subfolder_name: sfn })
    if (err) {
      showToast(`Move failed: ${err}`)
      return
    }
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, folder_name: fn, subfolder_name: sfn } : d
    ))
    showToast(`Moved to ${[fn, sfn].filter(Boolean).join(' / ') || 'top level'}.`)
  }

  function handleAddFolder(name) {
    setLocalFolders(lf => [...lf, { groupId: selectedGroupId, folderName: name, subfolderName: '' }])
    setModal(null)
    showToast(`Folder "${name}" created.`)
  }

  function handleAddSubfolder(folderName, subName) {
    setLocalFolders(lf => [...lf, { groupId: selectedGroupId, folderName, subfolderName: subName }])
    setModal(null)
    showToast(`Subfolder "${subName}" created.`)
  }

  return (
    <div style={{
      flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, sans-serif',
      // Full-page mode: break out of the global 480px-max centered container (src/app/layout.js)
      // and bound height to the viewport so the two panes scroll independently.
      ...(isWide ? { position: 'relative', width: '100vw', marginLeft: 'calc(50% - 50vw)', height: '100vh', overflow: 'hidden' } : {}),
    }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#1a56a0', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          ✓ {toast}
        </div>
      )}

      {modal && (
        <NameModal
          title={modal.type === 'folder' ? 'New Folder' : 'New Subfolder'}
          placeholder={modal.type === 'folder' ? 'Folder name…' : 'Subfolder name…'}
          onConfirm={name => modal.type === 'folder' ? handleAddFolder(name) : handleAddSubfolder(modal.parentFolderName, name)}
          onCancel={() => setModal(null)}
        />
      )}

      <PageHeader
        title={appName || 'My Docs'}
        appIcon={appIcon}
        onBack={
          selectedDoc ? () => setSelectedDocId(null)
          : selectedSubfolder ? () => setSelectedSubfolder(null)
          : selectedFolder ? () => { setSelectedFolderName(null); setSelectedSubfolder(null) }
          : undefined
        }
      />

      {/* ── DOC DETAIL VIEW ── */}
      {selectedDoc ? (
        // Admin controls are gated by the DOCUMENT's group, not the selected
        // one — search results span all of the caller's groups, so the two
        // can differ (and RLS would silently ignore a cross-group write).
        (() => {
          const docAdmin = canAdminGroup(docGid(selectedDoc))
          return (
            <GroupDocDetail
              doc={selectedDoc}
              isAdmin={docAdmin}
              onDelete={handleDeleteDoc}
              onBack={() => setSelectedDocId(null)}
              onToggleHidden={docAdmin ? handleToggleHidden : undefined}
              onToggleArchived={docAdmin ? handleToggleArchived : undefined}
            />
          )
        })()
      ) : (
      <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 12, borderBottom: '1.5px solid #d0e0f4' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents across all groups…"
          style={{ flex: 1, minWidth: 0, border: '1.5px solid #1a56a0', borderRadius: 4, padding: '8px 10px', fontSize: 14, color: '#1a56a0', outline: 'none', fontFamily: 'Segoe UI, sans-serif' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', flexShrink: 0 }}>×</button>
        )}
      </div>

      {/* Group selector */}
      {!search && (
        <div style={{ position: 'relative', padding: '0 16px 8px', zIndex: 10 }}>
          <div
            onClick={() => setGroupDropdownOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f5f8ff', border: '1.5px solid #1a56a0', borderRadius: 4, cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={{ fontSize: 18 }}>👥</span>
            <span style={{ fontWeight: 700, color: '#1a56a0', fontSize: 15, flex: 1 }}>{selectedGroup?.group_name || 'All Staff'}</span>
            {isAdmin && <span style={{ background: '#1a56a0', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 800 }}>ADMIN</span>}
            <span style={{ color: '#1a56a0', fontSize: 14 }}>{groupDropdownOpen ? '▲' : '▼'}</span>
          </div>
          {groupDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, background: '#fff', border: '1.5px solid #1a56a0', borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.13)', overflow: 'hidden', zIndex: 20 }}>
              {myGroups.map(g => (
                <div key={g.id} onClick={() => { setSelectedGroupId(g.id); setGroupDropdownOpen(false); setSelectedFolderName(null); setSelectedSubfolder(null) }}
                  style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, background: g.id === selectedGroupId ? '#e8f0fb' : '#fff', borderBottom: '1px solid #d0e0f4', color: g.id === selectedGroupId ? '#1a56a0' : '#333', fontWeight: g.id === selectedGroupId ? 700 : 400 }}>
                  <span>👥</span>
                  <span style={{ flex: 1 }}>{g.group_name}{g.isDefault && <span style={{ fontSize: 11, color: '#5580a0', marginLeft: 6 }}>· Everyone</span>}</span>
                  {g.isAdmin && <span style={{ background: '#e8f0fb', color: '#1a56a0', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>Admin</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter label + View Archived toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          {search
            ? `${searchResults?.length ?? 0} result${searchResults?.length !== 1 ? 's' : ''} for "${search}"`
            : `${selectedGroup?.group_name || 'All Staff'} · ${folderTree.length} folder${folderTree.length !== 1 ? 's' : ''} · ${totalDocs} document${totalDocs !== 1 ? 's' : ''}`
          }
        </span>
        <button onClick={() => setShowArchived(v => !v)}
          title="Show or hide archived documents"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: showArchived ? '#1a56a0' : '#fff',
            color: showArchived ? '#fff' : '#1a56a0',
            border: '1.5px solid #1a56a0', borderRadius: 5, padding: '3px 10px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif',
          }}>
          🗄 {showArchived ? 'Hide Archived' : 'View Archived'}
        </button>
      </div>

      {/* Admin action bar — context-aware (phone layout only; desktop explorer has its own controls) */}
      {isAdmin && !search && !isWide && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1.5px solid #d0e0f4', background: '#f5f8ff', flexWrap: 'wrap' }}>
          <input ref={quickUploadRef} type="file" style={{ display: 'none' }}
            onChange={e => {
              if (!e.target.files[0]) return
              const fn = selectedFolder?.name || ''
              const sfn = selectedSubfolder || ''
              handleUpload(e.target.files[0], fn, sfn)
              e.target.value = ''
            }} />
          {/* Add Folder: at root level creates folder, inside a folder creates subfolder */}
          {!selectedSubfolder && (
            <button onClick={() => {
              if (selectedFolder) setModal({ type: 'subfolder', parentFolderName: selectedFolder.name })
              else setModal({ type: 'folder' })
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #1a56a0', borderRadius: 6, padding: '6px 14px', color: '#1a56a0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
              <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 700 }}>＋</span>
              {selectedFolder ? 'Add Subfolder' : 'Add Folder'}
            </button>
          )}
          <button onClick={() => quickUploadRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #1a56a0', borderRadius: 6, padding: '6px 14px', color: '#1a56a0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 700 }}>＋</span>
            Add Document
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: isWide && !search ? 'flex' : 'block', overflowY: isWide && !search ? 'hidden' : 'auto' }}>
        {search && searchResults !== null ? (
          /* ── Search Results ── */
          searchResults.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>No documents found</div>
          ) : (
            searchResults.map(doc => <SearchDocRow key={doc.id} doc={doc} onSelect={openDoc} />)
          )
        ) : isWide ? (
          /* ── Desktop Two-Pane Explorer ── */
          <DesktopExplorer
            folderTree={folderTree}
            ungroupedDocs={ungroupedDocs}
            groupName={selectedGroup?.group_name || 'All Staff'}
            isAdmin={isAdmin}
            selectedFolder={selectedFolder}
            setSelectedFolder={openFolder}
            draggingDoc={draggingDoc}
            setDraggingDoc={setDraggingDoc}
            dragOverKey={dragOverKey}
            setDragOverKey={setDragOverKey}
            onDropMove={handleDropMove}
            onSelectDoc={openDoc}
            onDeleteDoc={handleDeleteDoc}
            onToggleHidden={handleToggleHidden}
            onToggleArchived={handleToggleArchived}
            onAddFolder={() => setModal({ type: 'folder' })}
            onAddSubfolder={(parent) => setModal({ type: 'subfolder', parentFolderName: parent })}
            onUpload={handleUpload}
            uploadingKey={uploadingKey}
          />
        ) : selectedFolder && selectedSubfolder ? (
          /* ── Subfolder Content View ── */
          (() => {
            const sf = selectedFolder.subfolders.find(s => s.name === selectedSubfolder)
            const docs = sf?.docs || []
            return (
              <>
                <button onClick={() => setSelectedSubfolder(null)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f5f8ff', border: 'none', borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer', fontSize: 13, color: '#1a56a0', fontWeight: 600, fontFamily: 'Segoe UI, sans-serif' }}>
                  <span style={{ fontSize: 16 }}>‹</span> {selectedFolder.name}
                </button>
                <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
                  {selectedSubfolder} · {docs.length} document{docs.length !== 1 ? 's' : ''}
                </div>
                {docs.map(doc => (
                  <DocRow key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDeleteDoc} onSelect={openDoc} isInSubfolder onMoveUp={handleMoveDocUp}
                    onToggleHidden={isAdmin ? handleToggleHidden : undefined} onToggleArchived={isAdmin ? handleToggleArchived : undefined} />
                ))}
                {docs.length === 0 && !isAdmin && (
                  <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>No documents in this subfolder</div>
                )}
              </>
            )
          })()
        ) : selectedFolder ? (
          /* ── Folder Content View (full screen) ── */
          <>
            <button onClick={() => { setSelectedFolderName(null); setSelectedSubfolder(null) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f5f8ff', border: 'none', borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer', fontSize: 13, color: '#1a56a0', fontWeight: 600, fontFamily: 'Segoe UI, sans-serif' }}>
              <span style={{ fontSize: 16 }}>‹</span> {selectedGroup?.group_name || 'All Staff'}
            </button>
            <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
              {selectedFolder.name} · {selectedFolder.subfolders.length > 0 ? `${selectedFolder.subfolders.length} subfolder${selectedFolder.subfolders.length !== 1 ? 's' : ''} · ` : ''}{selectedFolder.rootDocs.length + selectedFolder.subfolders.reduce((a, s) => a + s.docs.length, 0)} document{(selectedFolder.rootDocs.length + selectedFolder.subfolders.reduce((a, s) => a + s.docs.length, 0)) !== 1 ? 's' : ''}
            </div>
            {/* Subfolders */}
            {selectedFolder.subfolders.map(sf => (
              <button key={sf.name}
                onClick={() => setSelectedSubfolder(sf.name)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', background: '#fffdf5', border: 'none',
                  borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#fffdf5'}
              >
                <FolderCircle />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0', fontFamily: 'Segoe UI, sans-serif' }}>{sf.name}</div>
                  <div style={{ fontSize: 13, color: '#5580a0', marginTop: 2 }}>{sf.docs.length} document{sf.docs.length !== 1 ? 's' : ''}</div>
                </div>
                {isAdmin && sf.docs.length === 0 && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); handleDeleteSubfolder(selectedFolder.name, sf.name) }}
                    style={{ padding: '4px 8px', background: '#fde8e8', border: '1px solid #f5b3b3', borderRadius: 4, fontSize: 13, color: '#b02020', cursor: 'pointer', flexShrink: 0 }}>
                    🗑
                  </span>
                )}
                <span style={{ color: '#1a56a0', fontSize: 20, flexShrink: 0 }}>{'›'}</span>
              </button>
            ))}
            {/* Root docs in folder */}
            {selectedFolder.rootDocs.map(doc => (
              <DocRow key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDeleteDoc} onSelect={openDoc} hasSubfolders={selectedFolder.subfolders.length > 0} onMoveDown={(doc) => setMoveDownTarget({ doc, folderName: selectedFolder.name, subfolders: selectedFolder.subfolders })}
                onToggleHidden={isAdmin ? handleToggleHidden : undefined} onToggleArchived={isAdmin ? handleToggleArchived : undefined} />
            ))}
          </>
        ) : folderTree.length === 0 && ungroupedDocs.length === 0 ? (
          /* ── Empty State ── */
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
            <div style={{ fontWeight: 600, color: '#5580a0', marginBottom: 4 }}>No folders yet</div>
            {isAdmin ? <div>Use the + button to create a folder.</div> : <div>No documents have been added to this group.</div>}
          </div>
        ) : (
          /* ── Folder List View ── */
          <>
            {folderTree.map(folder => {
              const totalDocs = folder.rootDocs.length + folder.subfolders.reduce((a, s) => a + s.docs.length, 0)
              return (
                <button key={folder.name}
                  onClick={() => openFolder(folder)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', background: '#fff', border: 'none',
                    borderBottom: '1.5px solid #d0e0f4', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <FolderCircle />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a56a0', fontFamily: 'Segoe UI, sans-serif' }}>{folder.name}</div>
                    <div style={{ fontSize: 13, color: '#5580a0', marginTop: 2 }}>
                      {folder.subfolders.length > 0 && `${folder.subfolders.length} subfolder${folder.subfolders.length !== 1 ? 's' : ''} · `}
                      {totalDocs} document{totalDocs !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {isAdmin && totalDocs === 0 && folder.subfolders.length === 0 && (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.name) }}
                      style={{ padding: '4px 8px', background: '#fde8e8', border: '1px solid #f5b3b3', borderRadius: 4, fontSize: 13, color: '#b02020', cursor: 'pointer', flexShrink: 0 }}>
                      🗑
                    </span>
                  )}
                  <span style={{ color: '#1a56a0', fontSize: 20, flexShrink: 0 }}>{'›'}</span>
                </button>
              )
            })}
            {ungroupedDocs.map(doc => (
              <DocRow key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDeleteDoc} onSelect={openDoc}
                onToggleHidden={isAdmin ? handleToggleHidden : undefined} onToggleArchived={isAdmin ? handleToggleArchived : undefined} />
            ))}
          </>
        )}
      </div>
      </>
      )}

      {/* Move Down Picker Modal */}
      {moveDownTarget && (
        <div onClick={() => setMoveDownTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 480, padding: '16px 0', maxHeight: '50vh', overflow: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a56a0', padding: '0 16px 12px', borderBottom: '1.5px solid #d0e0f4', fontFamily: 'Segoe UI, sans-serif' }}>
              Move to subfolder
            </div>
            <div style={{ fontSize: 13, color: '#5580a0', padding: '8px 16px', fontFamily: 'Segoe UI, sans-serif' }}>
              Moving: {moveDownTarget.doc.document_name}
            </div>
            {moveDownTarget.subfolders.map(sf => (
              <button key={sf.name}
                onClick={() => handleMoveDocDown(moveDownTarget.doc, sf.name)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: '#fff', border: 'none',
                  borderBottom: '1px solid #f0f0f0', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ fontSize: 18 }}>📁</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1a56a0', fontFamily: 'Segoe UI, sans-serif' }}>{sf.name}</span>
                <span style={{ fontSize: 12, color: '#5580a0', marginLeft: 'auto' }}>{sf.docs.length} doc{sf.docs.length !== 1 ? 's' : ''}</span>
              </button>
            ))}
            <button onClick={() => setMoveDownTarget(null)}
              style={{ width: '100%', padding: '12px 16px', background: '#f5f8ff', border: 'none', borderTop: '1.5px solid #d0e0f4', fontSize: 14, fontWeight: 600, color: '#5580a0', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
