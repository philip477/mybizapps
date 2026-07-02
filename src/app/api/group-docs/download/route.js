import { createClient } from '@/lib/supabase-server'

// Stream a Group Document to the caller. `inline=1` renders in the browser
// (the same-origin URL is used inside the preview iframe, so the auth cookie
// rides along); otherwise it downloads as an attachment.
//
// Runs entirely as the caller: the row lookup goes through biz_group_documents
// RLS (facility isolation) and the storage download through the bucket's
// facility-scoped read policy — a foreign-facility id simply comes back empty.

const BUCKET = 'group-documents'
const UUID_RE = /^[0-9a-fA-F-]{36}$/

// Content-Type comes from the file extension against this allowlist — never
// from the stored mime_type — so a crafted row can't get text/html (or other
// active content) served from this cookie-bearing origin.
const CONTENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
}

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const inline = searchParams.get('inline') === '1'
  if (!id || !UUID_RE.test(id)) {
    return Response.json({ error: 'valid id is required' }, { status: 400 })
  }

  const { data: doc } = await supabase
    .from('biz_group_documents')
    .select('file_name, storage_path, is_active')
    .eq('id', id)
    .maybeSingle()
  if (!doc || !doc.is_active || !doc.storage_path) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(doc.storage_path)
  if (error || !blob) {
    console.error('Group doc download error:', error?.message || 'no data')
    return Response.json({ error: 'Failed to retrieve file' }, { status: 502 })
  }

  const buffer = await blob.arrayBuffer()
  const rawName = doc.file_name || 'download'
  const ext = rawName.split('.').pop()?.toLowerCase() || ''

  // RFC 6266/5987: a pure-ASCII fallback in filename= (header values are
  // ByteStrings — a raw em dash or CJK name would make Response() throw) plus
  // the real name percent-encoded in filename*.
  const asciiName = rawName.replace(/["\r\n\\]/g, '_').replace(/[^\x20-\x7e]/g, '_') || 'download'
  const disposition = `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(rawName)}`

  return new Response(buffer, {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
