// POST /api/ai-generate
// Body: { type, description, style?, companyName? }
//   type:        'logo' | 'business-card-graphic' | 'flyer-graphic'
//   description: free-text describing the business / desired image (required)
//   style:       optional design style hint ('modern' | 'classic' | …)
//   companyName: optional, used to flavor logo prompts
//
// Server-side AI image generation for the Marketing Tools app. Calls OpenAI's
// DALL·E 3 and returns the result as a base64 data URL (not the transient
// OpenAI URL) so the browser can both download it and composite it onto a
// <canvas> without tainting it — DALL·E URLs are cross-origin and expire in ~1h.
//
// The OPENAI_API_KEY is read from env and never reaches the client. When it's
// unset the route returns a clear 503 and the manual/template generators (which
// need no server) keep working — AI is an enhancement, not a requirement.
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// DALL·E 3 can take 15-30s; give the function room beyond the default.
export const maxDuration = 60

const VALID_TYPES = new Set(['logo', 'business-card-graphic', 'flyer-graphic'])

// DALL·E 3 only accepts these sizes. Logos/accents are square; flyer heroes are
// landscape to match the flyer's image band.
const SIZE_BY_TYPE = {
  logo: '1024x1024',
  'business-card-graphic': '1024x1024',
  'flyer-graphic': '1792x1024',
}

const STYLE_HINTS = {
  modern: 'modern, sleek, contemporary',
  classic: 'classic, timeless, elegant',
  minimalist: 'minimalist, simple, lots of negative space',
  minimal: 'minimalist, simple, lots of negative space',
  bold: 'bold, high-contrast, striking',
  playful: 'playful, friendly, vibrant',
}

// Build a DALL·E prompt tuned to each asset type. Logos in particular need
// strong guidance toward a clean, printable mark on a white background and away
// from DALL·E's tendency to add garbled lettering.
function buildPrompt({ type, description, style, companyName }) {
  const desc = (description || '').trim()
  const styleHint = STYLE_HINTS[(style || '').toLowerCase()] || 'professional'

  if (type === 'logo') {
    const who = [companyName && `for a company called "${companyName}"`, desc && `(${desc})`]
      .filter(Boolean)
      .join(' ')
    return (
      `A clean, professional, ${styleHint} business logo ${who}. ` +
      `Simple flat vector emblem / iconic symbol, centered, on a plain solid white background. ` +
      `Minimal color palette, crisp edges, balanced composition, suitable for print and web. ` +
      `No text, no words, no lettering, no photographic detail, no drop shadows, no gradients.`
    )
  }

  if (type === 'business-card-graphic') {
    return (
      `A ${styleHint} decorative abstract accent graphic for a business card background` +
      `${desc ? ` themed around ${desc}` : ''}. ` +
      `Subtle geometric or organic pattern, soft tasteful colors, generous clean empty space ` +
      `so overlaid text stays readable, on a white background. No text, no words, no logos.`
    )
  }

  // flyer-graphic (hero image)
  return (
    `A high-quality ${styleHint} promotional hero image for a marketing flyer: ${desc}. ` +
    `Well-lit, sharp, professional, visually appealing, with clear focal subject. No text, no words, no watermarks.`
  )
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // --- Auth: must be a logged-in, provisioned user --------------------------
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // --- Facility AI opt-out --------------------------------------------------
  // AI Assist is a facility-wide setting (Business Config → General Settings),
  // stored in biz_facility_config and defaulting ON when no row exists. RLS
  // scopes this read to the caller's facility, so no facility_id is needed here.
  // Only an explicit 'false' disables AI; a missing row keeps features on.
  const { data: aiSetting } = await supabase
    .from('biz_facility_config')
    .select('config_value')
    .eq('config_key', 'ai_assist_enabled')
    .maybeSingle()
  if (aiSetting?.config_value === 'false') {
    return Response.json(
      {
        error:
          'AI features are turned off for your company. An administrator can ' +
          're-enable them under Business Config → General Settings → AI Assist.',
      },
      { status: 403 }
    )
  }

  // --- Validate input -------------------------------------------------------
  const type = body?.type
  if (!VALID_TYPES.has(type)) {
    return Response.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 }
    )
  }
  const description = (body?.description || '').trim()
  if (!description && type !== 'business-card-graphic') {
    // The card accent can fall back to a generic pattern; logos and flyer
    // heroes need a description to be useful.
    return Response.json({ error: 'A description is required.' }, { status: 400 })
  }

  // --- Configuration check (inert until OPENAI_API_KEY is set) --------------
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          'AI generation is not configured yet (OPENAI_API_KEY missing). ' +
          'You can keep using the manual designer below.',
      },
      { status: 503 }
    )
  }

  const prompt = buildPrompt({ type, description, style: body?.style, companyName: body?.companyName })
  const size = SIZE_BY_TYPE[type]

  // --- Generate -------------------------------------------------------------
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'standard', // keep costs down
      response_format: 'b64_json', // return bytes, not a transient URL
    })

    const b64 = result?.data?.[0]?.b64_json
    if (!b64) {
      return Response.json({ error: 'No image was returned by the AI service.' }, { status: 502 })
    }

    // Lightweight usage tracking — log per facility so generations can be
    // monitored for cost without a schema/RLS change. (Writing a counter to
    // biz_app_config would require facility-admin RLS; a log line is enough.)
    console.log(
      `[ai-generate] facility=${user.user_metadata?.facility_id ?? '?'} user=${user.email} type=${type} size=${size}`
    )

    return Response.json({
      image: `data:image/png;base64,${b64}`,
      revisedPrompt: result?.data?.[0]?.revised_prompt || null,
    })
  } catch (e) {
    // Map common OpenAI failures to useful messages/status codes.
    const status = e?.status || e?.response?.status
    if (status === 429) {
      return Response.json(
        { error: 'AI service is rate-limited or out of quota. Please try again shortly.' },
        { status: 429 }
      )
    }
    if (status === 401) {
      return Response.json(
        { error: 'AI service rejected the API key. Check OPENAI_API_KEY.' },
        { status: 502 }
      )
    }
    if (status === 400) {
      // e.g. content policy rejection of the prompt.
      return Response.json(
        { error: e?.message || 'The AI service rejected this request. Try rephrasing your description.' },
        { status: 400 }
      )
    }
    console.error('[ai-generate] error', e)
    return Response.json(
      { error: e?.message || 'AI generation failed. Please try again.' },
      { status: 502 }
    )
  }
}
