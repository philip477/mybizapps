import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'

// POST /api/invoices/send
// Body: { invoice_id }
// Loads the invoice + line items + customer, emails it via Resend, marks the
// invoice as sent, and records the send in biz_invoice_sends.
//
// Email delivery is gated on RESEND_API_KEY: when it's unset the invoice is
// still marked sent/recorded but no email goes out (emailed:false + warning),
// mirroring the inert-until-configured pattern used for Stripe. The sender
// address comes from RESEND_FROM (falling back to Resend's shared test sender).
export const runtime = 'nodejs'

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Escape user-entered invoice text before interpolating it into the email HTML.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function customerName(c) {
  return c?.company_name || `${c?.first_name || ''} ${c?.last_name || ''}`.trim() || c?.email || 'Customer'
}

function fmtDate(d) {
  if (!d) return null
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return d
  }
}

function buildEmail(invoice, items, customer, businessName) {
  const isQuote = invoice.doc_type === 'quote'
  const label = isQuote ? 'Quote' : 'Invoice'
  const number = invoice.invoice_number || '(no number)'
  const subject = `${label} ${number}${businessName ? ` from ${businessName}` : ''}`
  const dateLabel = isQuote ? 'Valid until' : 'Due'
  const due = fmtDate(invoice.due_date)

  const rows = [...items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;color:#1a1a2e;font-size:14px;">${esc(it.description)}</td>
          <td align="center" style="padding:8px 12px;border-bottom:1px solid #eef2f7;color:#5580a0;font-size:14px;">${Number(it.quantity || 0)}</td>
          <td align="right" style="padding:8px 12px;border-bottom:1px solid #eef2f7;color:#5580a0;font-size:14px;">${money(it.unit_price)}</td>
          <td align="right" style="padding:8px 12px;border-bottom:1px solid #eef2f7;color:#1a1a2e;font-size:14px;font-weight:600;">${money(it.amount)}</td>
        </tr>`,
    )
    .join('')

  const totalsRow = (lbl, val, bold) => `
    <tr>
      <td colspan="2"></td>
      <td align="right" style="padding:4px 12px;color:${bold ? '#1a56a0' : '#5580a0'};font-size:${bold ? 16 : 14}px;font-weight:${bold ? 800 : 500};">${lbl}</td>
      <td align="right" style="padding:4px 12px;color:${bold ? '#1a56a0' : '#1a1a2e'};font-size:${bold ? 16 : 14}px;font-weight:${bold ? 800 : 600};">${money(val)}</td>
    </tr>`

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
    <div style="border-bottom:3px solid #1a56a0;padding:16px 4px;">
      <div style="font-size:22px;font-weight:800;color:#1a56a0;">${esc(businessName || 'Invoice')}</div>
      <div style="font-size:14px;color:#5580a0;margin-top:2px;">${label} ${esc(number)}</div>
    </div>

    <div style="padding:16px 4px;font-size:14px;color:#1a1a2e;line-height:1.6;">
      Hi ${esc(customerName(customer))},<br/>
      Please find your ${label.toLowerCase()} below${due ? ` — <strong>${dateLabel.toLowerCase()} ${esc(due)}</strong>` : ''}.
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px;">
      <thead>
        <tr>
          <th align="left" style="padding:8px 12px;background:#f5f8ff;border-bottom:1.5px solid #d0e0f4;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:#5580a0;">Description</th>
          <th align="center" style="padding:8px 12px;background:#f5f8ff;border-bottom:1.5px solid #d0e0f4;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:#5580a0;">Qty</th>
          <th align="right" style="padding:8px 12px;background:#f5f8ff;border-bottom:1.5px solid #d0e0f4;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:#5580a0;">Unit</th>
          <th align="right" style="padding:8px 12px;background:#f5f8ff;border-bottom:1.5px solid #d0e0f4;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:#5580a0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="padding:12px;color:#5580a0;font-size:14px;">No line items.</td></tr>'}
      </tbody>
      <tfoot>
        ${totalsRow('Subtotal', invoice.subtotal)}
        ${Number(invoice.tax_amount) > 0 ? totalsRow(`Tax (${Number(invoice.tax_rate || 0)}%)`, invoice.tax_amount) : ''}
        ${totalsRow('Total', invoice.total, true)}
      </tfoot>
    </table>

    ${invoice.notes ? `<div style="padding:14px 4px;font-size:13px;color:#5580a0;line-height:1.6;"><strong style="color:#1a1a2e;">Notes:</strong> ${esc(invoice.notes)}</div>` : ''}
    ${invoice.terms ? `<div style="padding:0 4px 14px;font-size:13px;color:#5580a0;line-height:1.6;"><strong style="color:#1a1a2e;">Terms:</strong> ${esc(invoice.terms)}</div>` : ''}

    <div style="border-top:1px solid #eef2f7;padding:14px 4px;font-size:12px;color:#9aa7b8;">
      Sent via ${esc(businessName || 'MyBizApps')}.
    </div>
  </div>`

  return { subject, html }
}

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

  // Business name for the email header (RLS scopes to the caller's facility).
  const { data: facility } = await supabase
    .from('facilities')
    .select('name')
    .eq('id', invoice.facility_id)
    .maybeSingle()

  const items = invoice.biz_invoice_items || []
  const { subject, html } = buildEmail(invoice, items, customer, facility?.name)

  // --- Send the email -------------------------------------------------------
  // When RESEND_API_KEY is set we send for real and FAIL the request if Resend
  // rejects it (so the invoice isn't marked sent on a failed delivery). When it
  // isn't set we fall through and record the send without emailing.
  const emailConfigured = !!process.env.RESEND_API_KEY
  if (emailConfigured) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'MyBizApps <onboarding@resend.dev>',
        to: recipient,
        replyTo: user.email || undefined,
        subject,
        html,
      })
      if (sendError) {
        return Response.json({ error: `Email failed: ${sendError.message || 'Resend error'}` }, { status: 502 })
      }
    } catch (e) {
      return Response.json({ error: `Email failed: ${e.message || 'Resend error'}` }, { status: 502 })
    }
  }

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
    subject,
  })
  if (sendErr) {
    // The invoice is already marked sent; surface the logging failure but don't
    // pretend it didn't send.
    return Response.json(
      { ok: true, emailed: emailConfigured, warning: `Send recorded with error: ${sendErr.message}` },
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
