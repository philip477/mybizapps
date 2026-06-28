import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// POST /api/upload  (multipart/form-data)
//   file:   the image File
//   bucket: 'app-icons' | 'company-logos'
//   prefix: optional filename prefix (e.g. "app-123") for tidy storage paths
//
// Client Components can't write to Supabase Storage directly here — the anon
// key is blocked by storage RLS. So uploads funnel through this route, which
// verifies the caller is a logged-in master_control operator and then uses the
// service-role admin client to (idempotently) ensure the bucket exists and
// write the object. Returns { url } with the public URL on success.

// Buckets this route is allowed to write to, with their config.
const ALLOWED_BUCKETS = new Set(['app-icons', 'company-logos'])

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request) {
  // --- Authenticate + authorize -------------------------------------------
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('user_role')
    .ilike('email', user.email)
    .maybeSingle()
  if (!bizUser || bizUser.user_role !== 'master_control') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- Parse the upload ----------------------------------------------------
  let form
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  const bucket = form.get('bucket')
  const prefix = form.get('prefix')

  if (!file || typeof file === 'string') {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return Response.json({ error: 'Invalid bucket' }, { status: 400 })
  }
  if (!file.type?.startsWith('image/')) {
    return Response.json({ error: 'File must be an image' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Image must be under 5 MB' }, { status: 400 })
  }

  // --- Service-role upload --------------------------------------------------
  const admin = createAdminClient()
  if (!admin) {
    return Response.json(
      { error: 'Uploads are not configured (SUPABASE_SERVICE_ROLE_KEY is missing).' },
      { status: 500 }
    )
  }

  // Ensure the bucket exists. createBucket errors if it's already there — that
  // case is fine, anything else is a real failure.
  const { error: bucketErr } = await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  })
  if (bucketErr && !/exist/i.test(bucketErr.message)) {
    return Response.json({ error: `Bucket setup failed: ${bucketErr.message}` }, { status: 500 })
  }

  // Build a clean, collision-resistant object path.
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const safePrefix = String(prefix || '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  const path = `${safePrefix ? `${safePrefix}_` : ''}${Date.now()}.${ext}`

  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(path, bytes, { upsert: true, contentType: file.type })
  if (upErr) {
    return Response.json({ error: `Upload failed: ${upErr.message}` }, { status: 502 })
  }

  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path)
  return Response.json({ url: pub.publicUrl })
}
