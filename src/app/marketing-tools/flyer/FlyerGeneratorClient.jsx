'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { downloadCanvas, loadImage, wrapText, slugify } from '../canvasUtils'

// Letter size 8.5" x 11". Download at 150 DPI (1275 x 1650).
const FLYER_W = 1275
const FLYER_H = 1650

const TEMPLATES = [
  { key: 'promo', label: 'Sale / Promo', badge: 'SALE' },
  { key: 'announcement', label: 'Announcement', badge: 'NEWS' },
  { key: 'event', label: 'Event', badge: 'EVENT' },
  { key: 'service', label: 'Service Highlight', badge: 'SERVICE' },
]

const COLORS = ['#1a56a0', '#0f9d58', '#d93025', '#f4b400', '#6a1b9a', '#00838f', '#e8710a', '#202124']

const fieldStyle = {
  width: '100%', padding: '8px 10px', fontSize: 15, border: '1.5px solid #d0e0f4',
  borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#5580a0', marginBottom: 4 }

const DEFAULTS = {
  headline: 'Big Summer Sale',
  subheadline: 'Save up to 25% on all services this month. Book now and beat the rush — limited spots available.',
}

export default function FlyerGeneratorClient({ initial }) {
  const router = useRouter()
  const [headline, setHeadline] = useState(DEFAULTS.headline)
  const [subheadline, setSubheadline] = useState(DEFAULTS.subheadline)
  const [company, setCompany] = useState(initial.company || 'Your Company')
  const [contact, setContact] = useState(initial.contact || 'call (555) 123-4567')
  const [template, setTemplate] = useState('promo')
  const [color, setColor] = useState('#d93025')
  const [imageData, setImageData] = useState(null)
  const [busy, setBusy] = useState(false)

  const tmpl = TEMPLATES.find((t) => t.key === template) || TEMPLATES[0]

  function onImagePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageData(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleDownload() {
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = FLYER_W
      canvas.height = FLYER_H
      const ctx = canvas.getContext('2d')
      const img = await loadImage(imageData)
      drawFlyer(ctx, { headline, subheadline, company, contact, color, template, badge: tmpl.badge, img })
      downloadCanvas(canvas, `${slugify(headline || company, 'flyer')}-flyer`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PageHeader title="Flyer Generator" onBack={() => router.push('/marketing-tools')} appIcon="📰" />

      {/* Live preview at letter proportions (8.5:11). */}
      <div style={{ background: '#f5f8ff', padding: '16px 12px', borderBottom: '1.5px solid #d0e0f4', display: 'flex', justifyContent: 'center' }}>
        <FlyerPreview {...{ headline, subheadline, company, contact, color, template, badge: tmpl.badge, imageData }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 14 }}>
        <Section label="Template">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => setTemplate(t.key)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                border: template === t.key ? '2.5px solid #1a56a0' : '1.5px solid #d0e0f4',
                background: template === t.key ? '#f0f6ff' : '#fff', color: '#1a56a0',
              }}>{t.label}</button>
            ))}
          </div>
        </Section>

        <Section label="Accent color">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-label={c} style={{
                width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? '3px solid #202124' : '2px solid #fff', boxShadow: '0 0 0 1px #d0e0f4',
              }} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
          </div>
        </Section>

        <div style={{ padding: '0 12px' }}>
          <Field label="Headline"><input style={fieldStyle} value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
          <Field label="Subheadline / description">
            <textarea style={{ ...fieldStyle, minHeight: 72, resize: 'vertical' }} value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
          </Field>
          <Field label="Company"><input style={fieldStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
          <Field label="Contact info"><input style={fieldStyle} value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label="Image (optional)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{
                display: 'inline-block', padding: '8px 14px', fontSize: 14, fontWeight: 600,
                color: '#1a56a0', background: '#fff', border: '1.5px solid #d0e0f4', borderRadius: 8, cursor: 'pointer',
              }}>
                {imageData ? 'Change image' : 'Upload image'}
                <input type="file" accept="image/*" onChange={onImagePick} style={{ display: 'none' }} />
              </label>
              {imageData && (
                <button onClick={() => setImageData(null)} style={{
                  padding: '8px 12px', fontSize: 14, color: '#d93025', background: '#fff',
                  border: '1.5px solid #d0e0f4', borderRadius: 8, cursor: 'pointer',
                }}>Remove</button>
              )}
            </div>
          </Field>
        </div>

        <div style={{ padding: '8px 12px 28px' }}>
          <button onClick={handleDownload} disabled={busy} style={{
            width: '100%', padding: '12px', fontSize: 16, fontWeight: 700, color: '#fff',
            background: busy ? '#88a8cc' : '#1a56a0', border: 'none', borderRadius: 8,
            cursor: busy ? 'default' : 'pointer',
          }}>
            {busy ? 'Rendering…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Live DOM preview ------------------------------------------------------

function FlyerPreview({ headline, subheadline, company, contact, color, badge, imageData }) {
  // 280 x 362 keeps the 8.5:11 ratio.
  const box = {
    width: 280, height: 362, background: '#fff', borderRadius: 6, overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.18)', position: 'relative', boxSizing: 'border-box',
    fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column',
  }
  return (
    <div style={box}>
      {/* Top color band with badge + headline */}
      <div style={{ background: color, color: '#fff', padding: '18px 16px 16px' }}>
        <span style={{
          display: 'inline-block', fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: 3, marginBottom: 8,
        }}>{badge}</span>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.05 }}>{headline || 'Headline'}</div>
      </div>

      {/* Optional image */}
      {imageData && (
        <div style={{ height: 110, background: `#eee center/cover no-repeat url(${imageData})` }} />
      )}

      {/* Body */}
      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{subheadline}</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `3px solid ${color}`, padding: '10px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>{company || 'Company'}</div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{contact}</div>
      </div>
    </div>
  )
}

// ---- Canvas renderer (download) -------------------------------------------

function drawFlyer(ctx, o) {
  const { color } = o
  const sans = "'Segoe UI', Arial, sans-serif"
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, FLYER_W, FLYER_H)

  // Top color band.
  const bandH = o.img ? 360 : 480
  ctx.fillStyle = color
  ctx.fillRect(0, 0, FLYER_W, bandH)

  // Badge pill.
  const pad = 90
  ctx.font = `800 30px ${sans}`
  const badgeW = ctx.measureText(o.badge).width + 50
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  roundRect(ctx, pad, 90, badgeW, 50, 8)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(o.badge, pad + 25, 116)
  ctx.textBaseline = 'alphabetic'

  // Headline (wrapped).
  ctx.fillStyle = '#ffffff'
  ctx.font = `900 84px ${sans}`
  const hlLines = wrapText(ctx, o.headline || 'Headline', FLYER_W - pad * 2)
  let y = 230
  for (const line of hlLines.slice(0, 3)) { ctx.fillText(line, pad, y); y += 92 }

  // Optional image below the band.
  let bodyTop = bandH + 60
  if (o.img) {
    const imgH = 420
    const imgW = FLYER_W - pad * 2
    // cover-fit the image into the box.
    const scale = Math.max(imgW / o.img.width, imgH / o.img.height)
    const dw = o.img.width * scale
    const dh = o.img.height * scale
    const dx = pad + (imgW - dw) / 2
    const dy = bandH + (imgH - dh) / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(pad, bandH, imgW, imgH)
    ctx.clip()
    ctx.drawImage(o.img, dx, dy, dw, dh)
    ctx.restore()
    bodyTop = bandH + imgH + 70
  }

  // Subheadline / description (wrapped).
  ctx.fillStyle = '#444444'
  ctx.font = `38px ${sans}`
  const subLines = wrapText(ctx, o.subheadline || '', FLYER_W - pad * 2)
  let sy = bodyTop
  for (const line of subLines) { ctx.fillText(line, pad, sy); sy += 56 }

  // Footer.
  const footY = FLYER_H - 200
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(pad, footY)
  ctx.lineTo(FLYER_W - pad, footY)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.font = `800 56px ${sans}`
  ctx.fillText(o.company || 'Company', pad, footY + 70)
  ctx.fillStyle = '#555555'
  ctx.font = `32px ${sans}`
  ctx.fillText(o.contact || '', pad, footY + 120)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ---- Small shared UI bits --------------------------------------------------

function Section({ label, children }) {
  return (
    <div style={{ padding: '0 12px', marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}
