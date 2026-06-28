import { createClient } from '@/lib/supabase-server'

// POST /api/invoices/send
// Body: { invoice_id }
// Loads the invoice + line items + customer, "sends" it (Resend TODO below),
// marks the invoice as sent, and records the send in biz_invoice_sends.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const invoiceId = body?.invoice_id
  if (!invoiceId) {
    return Response.json({ error: 'invoice_id is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Identify the sender (server-validated auth user).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Load the invoice with its line items and customer. RLS scopes to facility.
  const { data: invoice, error: loadErr } = await supabase
    .from('biz_invoices')
    .select('*, biz_invoice_items(*), biz_customers(*)')
    .eq('id', invoiceId)
    .maybeSingle()

  if (loadErr) {
    return Response.json({ error: loadErr.message }, { status: 500 })
  }
  if (!invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const customer = invoice.biz_customers
  const recipient = customer?.email || null
  // sent_to is NOT NULL — refuse rather than fail the insert downstream.
  if (!recipient) {
    return Response.json(
      { error: 'This customer has no email address on file.' },
      { status: 400 }
    )
  }

  // --- Send the email -------------------------------------------------------
  // Email delivery is gated on RESEND_API_KEY. Until it's configured (and the
  // `resend` package installed) we record the send but do NOT claim an email
  // went out — the response carries emailed:false + a warning so callers aren't
  // misled. TODO when configured:
  //   const { Resend } = await import('resend')
  //   await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to: recipient, subject, html })
  const emailConfigured = !!process.env.RESEND_API_KEY
  console.log('[invoices/send] record send', {
    invoice_number: invoice.invoice_number,
    doc_type: invoice.doc_type,
    to: recipient,
    emailed: emailConfigured,
  })

  const sentAt = new Date().toISOString()

  // Mark the invoice as sent.
  const { error: updErr } = await supabase
    .from('biz_invoices')
    .update({ status: 'sent', sent_at: sentAt })
    .eq('id', invoiceId)
  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 })
  }

  // Record the send. sent_by is a biz_users.id FK — not the auth uid or email.
  const { data: bizUser } = await supabase
    .from('biz_users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  const { error: sendErr } = await supabase.from('biz_invoice_sends').insert({
    invoice_id: invoiceId,
    sent_at: sentAt,
    sent_to: recipient,
    sent_by: bizUser?.id ?? null,
    send_method: 'email',
  })
  if (sendErr) {
    // The invoice is already marked sent; surface the logging failure but don't
    // pretend it didn't send.
    return Response.json(
      { ok: true, warning: `Send recorded with error: ${sendErr.message}` },
      { status: 200 }
    )
  }

  return Response.json({
    ok: true,
    sent_to: recipient,
    sent_at: sentAt,
    emailed: emailConfigured,
    ...(emailConfigured
      ? {}
      : {
          warning:
            'Email delivery is not configured (RESEND_API_KEY missing). The invoice was marked sent and the send was recorded, but no email was delivered.',
        }),
  })
}
