// Render a Group Document .docx as HTML for inline preview (no PDF infra).
// Pulls the file from the private `group-documents` bucket, converts with
// mammoth, and returns a styled HTML page that the preview iframe loads
// same-origin (so the auth cookie is sent).
//
// Row lookup + storage download both run as the caller, so RLS enforces the
// facility boundary before any bytes are read.
import { createClient } from '@/lib/supabase-server'
import mammoth from 'mammoth'

const BUCKET = 'group-documents'
const UUID_RE = /^[0-9a-fA-F-]{36}$/

function htmlError(message, status = 400) {
  const page = `<!doctype html><meta charset="utf-8"><body style="font-family:Segoe UI,system-ui,sans-serif;color:#b02020;padding:24px;font-size:14px">${message}</body>`
  return new Response(page, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return htmlError('Not authenticated.', 401)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return htmlError('Missing document id.', 400)

  const { data: doc } = await supabase
    .from('biz_group_documents')
    .select('document_name, storage_path, is_active')
    .eq('id', id)
    .maybeSingle()
  if (!doc || !doc.is_active || !doc.storage_path) return htmlError('Document not found.', 404)

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(doc.storage_path)
  if (error || !blob) return htmlError('Could not retrieve the file.', 502)
  const buffer = Buffer.from(await blob.arrayBuffer())

  // Legacy binary .doc (D0 CF 11 E0) saved as .docx — mammoth can't read it.
  if (buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return htmlError('This is a legacy Word (.doc) file, which can’t be previewed. Please download it instead.', 415)
  }

  let bodyHtml = ''
  try {
    const r = await mammoth.convertToHtml({ buffer })
    bodyHtml = r.value || ''
  } catch (e) {
    return htmlError(`Could not convert this document for preview: ${e.message}. Try downloading it instead.`, 422)
  }
  if (!bodyHtml.trim()) return htmlError('This document appears to be empty.', 200)

  const page = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #222; line-height: 1.5; max-width: 820px; margin: 0 auto; padding: 28px 24px 48px; }
  h1,h2,h3,h4 { color: #1a56a0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #d0e0f4; padding: 6px 8px; text-align: left; }
  img { max-width: 100%; height: auto; }
  a { color: #1a56a0; }
</style></head><body>${bodyHtml}</body></html>`

  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
