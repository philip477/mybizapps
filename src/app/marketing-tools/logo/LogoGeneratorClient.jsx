'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { downloadCanvas, downloadDataUrl, slugify, FONT_STACKS } from '../canvasUtils'
import { generateAiImage } from '../aiClient'

const AI_STYLES = [
  { key: 'modern', label: 'Modern' },
  { key: 'classic', label: 'Classic' },
  { key: 'minimalist', label: 'Minimalist' },
  { key: 'bold', label: 'Bold' },
  { key: 'playful', label: 'Playful' },
]

const FONTS = [
  { key: 'modern', label: 'Modern', weight: 600 },
  { key: 'classic', label: 'Classic', weight: 600 },
  { key: 'bold', label: 'Bold', weight: 900 },
  { key: 'minimal', label: 'Minimal', weight: 400 },
  { key: 'playful', label: 'Playful', weight: 700 },
]

const COLORS = ['#1a56a0', '#0f9d58', '#d93025', '#f4b400', '#6a1b9a', '#00838f', '#e8710a', '#202124']

const ICONS = [
  { key: 'none', emoji: '', label: 'None' },
  { key: 'wrench', emoji: '🔧', label: 'Wrench' },
  { key: 'building', emoji: '🏢', label: 'Building' },
  { key: 'gear', emoji: '⚙️', label: 'Gear' },
  { key: 'leaf', emoji: '🌿', label: 'Leaf' },
  { key: 'lightning', emoji: '⚡', label: 'Lightning' },
  { key: 'truck', emoji: '🚚', label: 'Truck' },
  { key: 'hammer', emoji: '🔨', label: 'Hammer' },
  { key: 'computer', emoji: '💻', label: 'Computer' },
  { key: 'heart', emoji: '❤️', label: 'Heart' },
  { key: 'star', emoji: '⭐', label: 'Star' },
]

const LAYOUTS = [
  { key: 'above', label: 'Icon above' },
  { key: 'left', label: 'Icon left' },
  { key: 'text', label: 'Text only' },
]

const fieldStyle = {
  width: '100%', padding: '8px 10px', fontSize: 15, border: '1.5px solid #d0e0f4',
  borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#5580a0', marginBottom: 4 }
const sectionStyle = { padding: '0 12px', marginBottom: 14 }

export default function LogoGeneratorClient({ companyName }) {
  const router = useRouter()
  const [mode, setMode] = useState('manual') // 'manual' | 'ai'
  const [name, setName] = useState(companyName || 'Your Company')
  const [font, setFont] = useState('modern')
  const [color, setColor] = useState('#1a56a0')
  const [icon, setIcon] = useState('gear')
  const [layout, setLayout] = useState('above')

  // AI generation state.
  const [aiDesc, setAiDesc] = useState('')
  const [aiStyle, setAiStyle] = useState('modern')
  const [aiImage, setAiImage] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)

  async function handleAiGenerate() {
    setAiBusy(true)
    setAiError(null)
    try {
      const { image } = await generateAiImage({
        type: 'logo',
        description: aiDesc,
        style: aiStyle,
        companyName: name,
      })
      setAiImage(image)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  const fontDef = FONTS.find((f) => f.key === font) || FONTS[0]
  const iconDef = ICONS.find((i) => i.key === icon) || ICONS[0]
  const showIcon = layout !== 'text' && iconDef.emoji

  function handleDownload() {
    const scale = 2
    const W = 800
    const H = layout === 'left' ? 360 : 500
    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    // White background.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const family = FONT_STACKS[font]
    const nameFontSize = 64

    if (layout === 'left' && showIcon) {
      const iconSize = 110
      ctx.font = `${iconSize}px ${family}`
      const iconW = ctx.measureText(iconDef.emoji).width
      ctx.font = `${fontDef.weight} ${nameFontSize}px ${family}`
      const textW = ctx.measureText(name).width
      const gap = 24
      const total = iconW + gap + textW
      const startX = (W - total) / 2
      ctx.textAlign = 'left'
      ctx.font = `${iconSize}px ${family}`
      ctx.fillText(iconDef.emoji, startX, H / 2)
      ctx.fillStyle = color
      ctx.font = `${fontDef.weight} ${nameFontSize}px ${family}`
      ctx.fillText(name, startX + iconW + gap, H / 2 + 4)
    } else {
      let cy = H / 2
      if (showIcon) {
        ctx.font = `150px ${family}`
        ctx.fillText(iconDef.emoji, W / 2, H / 2 - 70)
        cy = H / 2 + 110
      }
      ctx.fillStyle = color
      ctx.font = `${fontDef.weight} ${nameFontSize}px ${family}`
      ctx.fillText(name, W / 2, cy)
    }

    downloadCanvas(canvas, `${slugify(name, 'logo')}-logo`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PageHeader title="Logo Generator" onBack={() => router.push('/marketing-tools')} appIcon="🎨" />

      <TabBar mode={mode} setMode={setMode} />

      {/* Live preview */}
      <div style={{ background: '#f5f8ff', padding: '16px 12px', borderBottom: '1.5px solid #d0e0f4' }}>
        <div
          style={{
            background: '#ffffff', borderRadius: 10, border: '1px solid #e3e8f0',
            minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          {mode === 'manual' ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: layout === 'left' ? 'row' : 'column', gap: layout === 'left' ? 14 : 8,
            }}>
              {showIcon && (
                <span style={{ fontSize: layout === 'left' ? 56 : 72, lineHeight: 1 }}>{iconDef.emoji}</span>
              )}
              <span style={{
                fontFamily: FONT_STACKS[font], fontWeight: fontDef.weight, color,
                fontSize: 34, lineHeight: 1.1, textAlign: 'center', wordBreak: 'break-word',
              }}>
                {name || 'Your Company'}
              </span>
            </div>
          ) : aiImage ? (
            <img src={aiImage} alt="AI-generated logo" style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }} />
          ) : (
            <div style={{ color: '#88a8cc', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
              {aiBusy ? <Spinner label="Generating your logo…" /> : 'Describe your business below and tap Generate Logo.'}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 14 }}>
       {mode === 'ai' ? (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>Describe your business</label>
            <textarea
              style={{ ...fieldStyle, minHeight: 64, resize: 'vertical' }}
              value={aiDesc}
              onChange={(e) => setAiDesc(e.target.value)}
              placeholder="e.g. HVAC repair company in Ohio"
            />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Style</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AI_STYLES.map((s) => (
                <Chip key={s.key} active={aiStyle === s.key} onClick={() => setAiStyle(s.key)}>{s.label}</Chip>
              ))}
            </div>
          </div>

          {aiError && (
            <div style={{ ...sectionStyle, color: '#d93025', fontSize: 13, lineHeight: 1.5 }}>{aiError}</div>
          )}

          <div style={{ ...sectionStyle, marginTop: 16, marginBottom: 28, display: 'flex', gap: 8 }}>
            <button onClick={handleAiGenerate} disabled={aiBusy || !aiDesc.trim()} style={{
              flex: 1, padding: '12px', fontSize: 16, fontWeight: 700, color: '#fff',
              background: aiBusy || !aiDesc.trim() ? '#88a8cc' : '#1a56a0',
              border: 'none', borderRadius: 8, cursor: aiBusy || !aiDesc.trim() ? 'default' : 'pointer',
            }}>
              {aiBusy ? 'Generating…' : aiImage ? 'Regenerate' : 'Generate Logo'}
            </button>
            {aiImage && !aiBusy && (
              <button onClick={() => downloadDataUrl(aiImage, `${slugify(name, 'logo')}-ai-logo`)} style={{
                flex: 1, padding: '12px', fontSize: 16, fontWeight: 700, color: '#1a56a0',
                background: '#fff', border: '1.5px solid #1a56a0', borderRadius: 8, cursor: 'pointer',
              }}>
                Download PNG
              </button>
            )}
          </div>
        </>
       ) : (
        <>
        <div style={sectionStyle}>
          <label style={labelStyle}>Company name</label>
          <input style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Company" />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Font style</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FONTS.map((f) => (
              <Chip key={f.key} active={font === f.key} onClick={() => setFont(f.key)}
                style={{ fontFamily: FONT_STACKS[f.key], fontWeight: f.weight }}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Accent color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-label={c}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '3px solid #202124' : '2px solid #fff',
                  boxShadow: '0 0 0 1px #d0e0f4',
                }} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ICONS.map((i) => (
              <button key={i.key} onClick={() => setIcon(i.key)} title={i.label}
                style={{
                  width: 44, height: 44, borderRadius: 8, cursor: 'pointer',
                  border: icon === i.key ? '2.5px solid #1a56a0' : '1.5px solid #d0e0f4',
                  background: icon === i.key ? '#f0f6ff' : '#fff',
                  fontSize: i.emoji ? 24 : 11, color: '#5580a0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {i.emoji || 'None'}
              </button>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Layout</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {LAYOUTS.map((l) => (
              <Chip key={l.key} active={layout === l.key} onClick={() => setLayout(l.key)}>{l.label}</Chip>
            ))}
          </div>
        </div>

        <div style={{ ...sectionStyle, marginTop: 20, marginBottom: 28 }}>
          <button onClick={handleDownload} style={{
            width: '100%', padding: '12px', fontSize: 16, fontWeight: 700, color: '#fff',
            background: '#1a56a0', border: 'none', borderRadius: 8, cursor: 'pointer',
          }}>
            Download PNG
          </button>
        </div>
        </>
       )}
      </div>
    </div>
  )
}

function TabBar({ mode, setMode }) {
  const tab = (key, label) => (
    <button onClick={() => setMode(key)} style={{
      flex: 1, padding: '10px 8px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      border: 'none', background: 'transparent', color: mode === key ? '#1a56a0' : '#88a8cc',
      borderBottom: mode === key ? '3px solid #1a56a0' : '3px solid transparent',
    }}>{label}</button>
  )
  return (
    <div style={{ display: 'flex', background: '#fff', borderBottom: '1.5px solid #d0e0f4' }}>
      {tab('ai', '✨ AI Generate')}
      {tab('manual', '🎨 Manual Designer')}
    </div>
  )
}

function Spinner({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, border: '3px solid #d0e0f4', borderTopColor: '#1a56a0',
        borderRadius: '50%', animation: 'mtspin 0.8s linear infinite',
      }} />
      <span>{label}</span>
      <style>{'@keyframes mtspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

function Chip({ active, onClick, children, style }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
      border: active ? '2.5px solid #1a56a0' : '1.5px solid #d0e0f4',
      background: active ? '#f0f6ff' : '#fff', color: '#1a56a0',
      ...style,
    }}>
      {children}
    </button>
  )
}
