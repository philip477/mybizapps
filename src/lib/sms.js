// Minimal platform SMS sender.
//
// Mirrors the MyLTC Apps Twilio pattern (src/lib/sms/twilio.js): one call to
// the Programmable Messaging REST API via fetch — no SDK dependency. Uses the
// shared platform Twilio credentials:
//
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER   (the E.164 "from" number)
//
// If Twilio isn't configured, sendSms() resolves to a skipped result instead
// of throwing — callers (e.g. signup provisioning) stay fire-and-forget and
// never break their main flow over a notification.

function normalizeE164(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}

// sendSms({ to, body }) → { sent, skipped?, error?, sid? }
export async function sendSms({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
  const authToken = process.env.TWILIO_AUTH_TOKEN || ''
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || ''

  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, skipped: true, error: 'twilio not configured' }
  }

  const dest = normalizeE164(to)
  if (!dest || !(body || '').trim()) {
    return { sent: false, skipped: true, error: 'missing to/body' }
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`
  const params = new URLSearchParams()
  params.set('To', dest)
  params.set('From', normalizeE164(fromNumber) || fromNumber)
  params.set('Body', body)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.sid) {
      return { sent: true, sid: json.sid }
    }
    return { sent: false, error: json.message || json.code || `http ${res.status}` }
  } catch (e) {
    return { sent: false, error: e.message }
  }
}
