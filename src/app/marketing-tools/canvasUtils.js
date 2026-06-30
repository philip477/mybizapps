// Shared client-side helpers for the Marketing Tools generators. Everything
// here runs in the browser — the generators render a live HTML/CSS preview and
// reproduce that design on a <canvas> only at download time, so PNG export needs
// no server and no extra dependencies.

// Trigger a browser download of a canvas as a PNG file.
export function downloadCanvas(canvas, filename) {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Trigger a browser download of an existing data URL (e.g. an AI-generated
// PNG returned by /api/ai-generate) without going through a canvas.
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Load an image for canvas drawing. Requests CORS so the canvas stays
// untainted (Supabase storage allows cross-origin reads); resolves to null on
// any failure so a missing/blocked logo never breaks the export.
export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Word-wrap `text` to `maxWidth` using the context's current font. Returns an
// array of lines. `ctx.measureText` must reflect the font you'll draw with.
export function wrapText(ctx, text, maxWidth) {
  const lines = []
  for (const paragraph of String(text || '').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = words[i]
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

// Slugify a string into a safe filename stem.
export function slugify(text, fallback = 'download') {
  const s = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || fallback
}

// The font-family stacks shared by the previews and the canvas renderers, so
// what the user sees matches what downloads.
export const FONT_STACKS = {
  modern: "'Helvetica Neue', Arial, sans-serif",
  classic: "Georgia, 'Times New Roman', serif",
  bold: "'Arial Black', Impact, sans-serif",
  minimal: "'Segoe UI', system-ui, sans-serif",
  playful: "'Comic Sans MS', 'Trebuchet MS', cursive",
}
