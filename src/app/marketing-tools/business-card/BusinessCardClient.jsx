'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { downloadCanvas, loadImage, slugify } from '../canvasUtils'
import { generateAiImage } from '../aiClient'

// Standard card: 3.5" x 2". The preview renders at a fixed width; the download
// renders at 300 DPI (1050 x 600) for print quality.
const CARD_W = 1050
const CARD_H = 600

const TEMPLATES = [
  { key: 'clean', label: 'Clean' },
  { key: 'modern', label: 'Modern' },
  { key: 'bold', label: 'Bold' },
  { key: 'minimal', label: 'Minimal' },
]

const COLORS = ['#1a56a0', '#0f9d58', '#d93025', '#f4b400', '#6a1b9a', '#00838f', '#e8710a', '#202124']

const fieldStyle = {
  width: '100%', padding: '8px 10px', fontSize: 15, border: '1.5px solid #d0e0f4',
  borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#5580a0', marginBottom: 4 }

export default function BusinessCardClient({ initial }) {
  const router = useRouter()
  const [f, setF] = useState(initial)
  const [template, setTemplate] = useState('clean')
  const [color, setColor] = useState('#1a56a0')
  const [busy, setBusy] = useState(false)

  // AI background accent graphic (data URL composited onto the card).
  const [aiGraphic, setAiGraphic] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)

  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleAiGenerate() {
    setAiBusy(true)
    setAiError(null)
    try {
      const { image } = await generateAiImage({
        type: 'business-card-graphic',
        description: f.company ? `the business "${f.company}"` : '',
        style: template,
      })
      setAiGraphic(image)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    try {
      const scale = 1 // CARD_W is already print-resolution
      const canvas = document.createElement('canvas')
      canvas.width = CARD_W * scale
      canvas.height = CARD_H * scale
      const ctx = canvas.getContext('2d')
      const [logo, graphic] = await Promise.all([loadImage(f.logoUrl), loadImage(aiGraphic)])
      drawCard(ctx, { ...f, color, template, logo, graphic })
      downloadCanvas(canvas, `${slugify(f.name || f.company, 'business-card')}-card`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PageHeader title="Business Card" onBack={() => router.push('/marketing-tools')} appIcon="💼" />

      {/* Live preview — scaled DOM mock at card proportions (3.5:2). */}
      <div style={{ background: '#f5f8ff', padding: '16px 12px', borderBottom: '1.5px solid #d0e0f4', display: 'flex', justifyContent: 'center' }}>
        <CardPreview f={f} color={color} template={template} aiGraphic={aiGraphic} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 14 }}>
        <Section label="Template">
          <ChipRow items={TEMPLATES} value={template} onChange={setTemplate} />
        </Section>

        <Section label="Accent color">
          <ColorRow color={color} setColor={setColor} />
        </Section>

        <Section label="AI design accent">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleAiGenerate} disabled={aiBusy} style={{
              padding: '8px 14px', fontSize: 14, fontWeight: 700, color: '#fff',
              background: aiBusy ? '#88a8cc' : '#1a56a0', border: 'none', borderRadius: 8,
              cursor: aiBusy ? 'default' : 'pointer',
            }}>
              {aiBusy ? 'Generating…' : aiGraphic ? '✨ Regenerate design' : '✨ Generate design'}
            </button>
            {aiGraphic && !aiBusy && (
              <button onClick={() => setAiGraphic(null)} style={{
                padding: '8px 12px', fontSize: 14, color: '#d93025', background: '#fff',
                border: '1.5px solid #d0e0f4', borderRadius: 8, cursor: 'pointer',
              }}>Remove</button>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#88a8cc', marginTop: 6, lineHeight: 1.4 }}>
            AI creates a subtle background accent for your card.
          </div>
          {aiError && <div style={{ color: '#d93025', fontSize: 13, marginTop: 6 }}>{aiError}</div>}
        </Section>

        <div style={{ padding: '0 12px' }}>
          <Field label="Name"><input style={fieldStyle} value={f.name} onChange={set('name')} /></Field>
          <Field label="Title"><input style={fieldStyle} value={f.title} onChange={set('title')} placeholder="Job title" /></Field>
          <Field label="Company"><input style={fieldStyle} value={f.company} onChange={set('company')} /></Field>
          <Field label="Phone"><input style={fieldStyle} value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input style={fieldStyle} value={f.email} onChange={set('email')} /></Field>
          <Field label="Website"><input style={fieldStyle} value={f.website} onChange={set('website')} placeholder="example.com" /></Field>
          <Field label="Address"><input style={fieldStyle} value={f.address} onChange={set('address')} /></Field>
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

function CardPreview({ f, color, template, aiGraphic }) {
  // Preview box at 350x200 (10% of the print size, same 3.5:2 ratio). When an AI
  // accent is present we composite it behind a white veil so text stays legible.
  const base = {
    width: 350, height: 200, borderRadius: 8, position: 'relative',
    background: aiGraphic
      ? `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), center/cover no-repeat url(${aiGraphic})`
      : '#fff',
    overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxSizing: 'border-box',
  }
  const name = f.name || 'Your Name'
  const contact = [f.phone, f.email, f.website, f.address].filter(Boolean)

  if (template === 'bold') {
    return (
      <div style={base}>
        <div style={{ background: color, height: '100%', width: 120, position: 'absolute', left: 0, top: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <Logo f={f} light />
        </div>
        <div style={{ marginLeft: 120, padding: 16, height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#202124' }}>{name}</div>
          {f.title && <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 8 }}>{f.title}</div>}
          {contact.map((c, i) => <div key={i} style={{ fontSize: 10, color: '#444', lineHeight: 1.6 }}>{c}</div>)}
        </div>
      </div>
    )
  }

  if (template === 'modern') {
    return (
      <div style={base}>
        <div style={{ height: 6, background: color, width: '100%' }} />
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#202124' }}>{name}</div>
              {f.title && <div style={{ fontSize: 11, color, fontWeight: 600 }}>{f.title}</div>}
            </div>
            <Logo f={f} color={color} small />
          </div>
          <div style={{ marginTop: 14 }}>
            {contact.map((c, i) => <div key={i} style={{ fontSize: 10, color: '#444', lineHeight: 1.7 }}>{c}</div>)}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, fontWeight: 700, color }}>{f.company}</div>
      </div>
    )
  }

  if (template === 'minimal') {
    return (
      <div style={{ ...base, border: `1px solid #e3e8f0` }}>
        <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#202124', letterSpacing: 0.5 }}>{name}</div>
          {f.title && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{f.title}</div>}
          {f.company && <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 12 }}>{f.company}</div>}
          <div style={{ height: 2, width: 40, background: color, marginBottom: 10 }} />
          {contact.map((c, i) => <div key={i} style={{ fontSize: 10, color: '#555', lineHeight: 1.7 }}>{c}</div>)}
        </div>
      </div>
    )
  }

  // clean (default)
  return (
    <div style={base}>
      <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo f={f} color={color} small />
          <div style={{ fontSize: 14, fontWeight: 700, color }}>{f.company || 'Company'}</div>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#202124' }}>{name}</div>
          {f.title && <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{f.title}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
            {contact.map((c, i) => <div key={i} style={{ fontSize: 10, color: '#444' }}>{c}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Logo({ f, color, light, small }) {
  const size = small ? 32 : 56
  if (f.logoUrl) {
    return <img src={f.logoUrl} alt="" style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4 }} />
  }
  const initial = (f.company || f.name || '?').trim().charAt(0).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      background: light ? '#ffffff' : color, color: light ? color : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, fontWeight: 800,
    }}>{initial}</div>
  )
}

// ---- Canvas renderer (download) -------------------------------------------

function drawCard(ctx, o) {
  const { color, template } = o
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // AI background accent: cover-fit the graphic, then lay a white veil over it so
  // the card text stays readable (mirrors the preview's gradient overlay).
  if (o.graphic) {
    const scale = Math.max(CARD_W / o.graphic.width, CARD_H / o.graphic.height)
    const dw = o.graphic.width * scale
    const dh = o.graphic.height * scale
    ctx.drawImage(o.graphic, (CARD_W - dw) / 2, (CARD_H - dh) / 2, dw, dh)
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillRect(0, 0, CARD_W, CARD_H)
  }
  ctx.textBaseline = 'alphabetic'
  const sans = "'Segoe UI', Arial, sans-serif"
  const name = o.name || 'Your Name'
  const contact = [o.phone, o.email, o.website, o.address].filter(Boolean)

  const drawLogo = (x, y, size, light) => {
    if (o.logo) {
      ctx.drawImage(o.logo, x, y, size, size)
      return
    }
    const initial = (o.company || o.name || '?').trim().charAt(0).toUpperCase()
    ctx.fillStyle = light ? '#ffffff' : color
    roundRect(ctx, x, y, size, size, 12)
    ctx.fill()
    ctx.fillStyle = light ? color : '#ffffff'
    ctx.font = `800 ${size * 0.5}px ${sans}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initial, x + size / 2, y + size / 2 + 2)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
  }

  if (template === 'bold') {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 360, CARD_H)
    drawLogo(360 / 2 - 80, CARD_H / 2 - 80, 160, true)
    let x = 410
    ctx.fillStyle = '#202124'; ctx.font = `800 56px ${sans}`; ctx.fillText(name, x, 230)
    if (o.title) { ctx.fillStyle = color; ctx.font = `600 30px ${sans}`; ctx.fillText(o.title, x, 275) }
    ctx.fillStyle = '#444'; ctx.font = `28px ${sans}`
    contact.forEach((c, i) => ctx.fillText(c, x, 340 + i * 44))
    return
  }

  if (template === 'modern') {
    ctx.fillStyle = color; ctx.fillRect(0, 0, CARD_W, 18)
    drawLogo(CARD_W - 150, 60, 90, false)
    ctx.fillStyle = '#202124'; ctx.font = `700 54px ${sans}`; ctx.fillText(name, 60, 130)
    if (o.title) { ctx.fillStyle = color; ctx.font = `600 30px ${sans}`; ctx.fillText(o.title, 60, 172) }
    ctx.fillStyle = '#444'; ctx.font = `28px ${sans}`
    contact.forEach((c, i) => ctx.fillText(c, 60, 260 + i * 46))
    if (o.company) { ctx.fillStyle = color; ctx.font = `700 34px ${sans}`; ctx.textAlign = 'right'; ctx.fillText(o.company, CARD_W - 60, CARD_H - 50); ctx.textAlign = 'left' }
    return
  }

  if (template === 'minimal') {
    ctx.strokeStyle = '#e3e8f0'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2)
    let y = 230
    ctx.fillStyle = '#202124'; ctx.font = `600 60px ${sans}`; ctx.fillText(name, 60, y); y += 44
    if (o.title) { ctx.fillStyle = '#888'; ctx.font = `30px ${sans}`; ctx.fillText(o.title, 60, y); y += 38 }
    if (o.company) { ctx.fillStyle = color; ctx.font = `600 30px ${sans}`; ctx.fillText(o.company, 60, y); y += 30 }
    ctx.fillStyle = color; ctx.fillRect(60, y, 120, 6); y += 50
    ctx.fillStyle = '#555'; ctx.font = `28px ${sans}`
    contact.forEach((c, i) => ctx.fillText(c, 60, y + i * 44))
    return
  }

  // clean
  drawLogo(60, 56, 90, false)
  ctx.fillStyle = color; ctx.font = `700 40px ${sans}`; ctx.fillText(o.company || 'Company', 170, 115)
  ctx.fillStyle = '#202124'; ctx.font = `700 52px ${sans}`; ctx.fillText(name, 60, CARD_H - 180)
  if (o.title) { ctx.fillStyle = '#888'; ctx.font = `30px ${sans}`; ctx.fillText(o.title, 60, CARD_H - 140) }
  ctx.fillStyle = '#444'; ctx.font = `28px ${sans}`
  contact.forEach((c, i) => ctx.fillText(c, 60, CARD_H - 90 + i * 38))
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

function ChipRow({ items, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((it) => (
        <button key={it.key} onClick={() => onChange(it.key)} style={{
          padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
          border: value === it.key ? '2.5px solid #1a56a0' : '1.5px solid #d0e0f4',
          background: value === it.key ? '#f0f6ff' : '#fff', color: '#1a56a0',
        }}>{it.label}</button>
      ))}
    </div>
  )
}

function ColorRow({ color, setColor }) {
  return (
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
  )
}
