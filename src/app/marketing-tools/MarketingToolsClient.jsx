'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'

// The three generators, in launcher order.
const TOOLS = [
  {
    href: '/marketing-tools/logo',
    name: 'Logo Generator',
    emoji: '🎨',
    desc: 'Build a simple logo from a name, icon, and color.',
  },
  {
    href: '/marketing-tools/business-card',
    name: 'Business Card Generator',
    emoji: '💼',
    desc: 'Design a printable business card from your details.',
  },
  {
    href: '/marketing-tools/flyer',
    name: 'Flyer Generator',
    emoji: '📰',
    desc: 'Create a promo, event, or announcement flyer.',
  },
]

export default function MarketingToolsClient() {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PageHeader title="Marketing Tools" onBack={() => router.push('/')} appIcon="🎯" />

      <div style={{ fontSize: 12, color: '#888', background: '#f5f8ff', padding: '6px 16px', borderBottom: '1.5px solid #d0e0f4' }}>
        Quick generators for your brand — preview live, download a PNG.
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {TOOLS.map((tool) => (
          <div
            key={tool.href}
            onClick={() => router.push(tool.href)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 16px', borderBottom: '1.5px solid #d0e0f4',
              cursor: 'pointer', minHeight: 56, transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 6, flexShrink: 0, background: '#1a56a0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>{tool.emoji}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#1a56a0' }}>{tool.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{tool.desc}</div>
            </div>
            <span style={{ fontSize: 18, color: '#1a56a0', fontWeight: 'bold' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
