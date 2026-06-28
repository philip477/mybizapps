'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const C = '#1a56a0'
const C_BORDER = '#d0e0f4'

// ImageUploadField — a 72×72 tap-to-upload square used for app icons and
// company logos. Shows the current image, falls back to an emoji (or a "+"
// prompt) when none is set, previews the picked file immediately, and uploads
// straight to Supabase Storage from the browser (the buckets have authenticated
// upload/update/delete policies, so the logged-in operator's session is enough
// — no server round-trip). Calls onChange(publicUrl) on success, or
// onChange('') when the image is removed.
export default function ImageUploadField({
  value,
  emoji,
  bucket,
  prefix,
  onChange,
}) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(value || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return

    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }

    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const safePrefix = String(prefix || 'upload').replace(/[^a-zA-Z0-9_-]/g, '') || 'upload'
      const path = `${safePrefix}_${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      setPreview(data.publicUrl)
      onChange(data.publicUrl)
    } catch (err) {
      setError(err.message || 'Upload failed')
      setPreview(value || null) // revert to last saved image
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localUrl)
    }
  }

  function handleRemove() {
    setPreview(null)
    setError('')
    onChange('')
  }

  const showImg = !!preview
  const showEmoji = !showImg && !!emoji

  return (
    <div className="iuf">
      <div className="row">
        <button
          type="button"
          className="box"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Upload image"
        >
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="img" />
          ) : showEmoji ? (
            <span className="emoji">{emoji}</span>
          ) : (
            <span className="plus">＋</span>
          )}
          <span className="caption">{uploading ? 'Uploading…' : 'Tap to upload'}</span>
        </button>

        {showImg && !uploading && (
          <button type="button" className="remove" onClick={handleRemove}>
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {error && <div className="err">{error}</div>}

      <style jsx>{`
        .iuf {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .box {
          position: relative;
          width: 72px;
          height: 72px;
          flex-shrink: 0;
          border: 2px solid ${C};
          border-radius: 8px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
        }
        .box:disabled {
          cursor: default;
          opacity: 0.7;
        }
        .img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .emoji {
          font-size: 34px;
          line-height: 1;
        }
        .plus {
          font-size: 30px;
          color: ${C};
          line-height: 1;
        }
        .caption {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(26, 86, 160, 0.82);
          color: #fff;
          font-size: 9px;
          font-weight: 600;
          text-align: center;
          padding: 2px 0;
        }
        .remove {
          background: none;
          border: 1.5px solid ${C_BORDER};
          color: #b02020;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .err {
          color: #b02020;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
