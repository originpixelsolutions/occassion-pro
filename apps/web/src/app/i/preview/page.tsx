'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import InvitationViewer from '@/components/invitations/InvitationViewer'

const DEMO_EVENT = {
  id: 'preview',
  title: 'The Grand Celebration',
  description: 'A preview of your invitation',
  start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  timezone: 'Asia/Kolkata',
  venue_name: 'Grand Palace Ballroom',
  venue_address: 'Palace Road, Mumbai, Maharashtra 400001',
  cover_image_url: undefined,
  workspace: { name: 'Your Organization', logo_url: undefined },
}

export default function InvitationPreviewPage() {
  const params = useSearchParams()

  const config = useMemo(() => {
    const raw = params.get('config')
    if (!raw) return null
    try { return JSON.parse(decodeURIComponent(raw)) } catch { return null }
  }, [params])

  const templateSlug = params.get('theme') ?? 'royal-gold'
  const guestName = params.get('guest') ?? 'Your Guest'

  const THEME_CONFIGS: Record<string, unknown> = {
    'royal-gold': {
      background: { type: 'gradient', value: 'linear-gradient(135deg,#1a0a00 0%,#2d1400 50%,#1a0a00 100%)' },
      primaryColor: '#c9a84c', accentColor: '#f5d88a', textColor: '#f5e6c8',
      fontHeading: 'Cormorant Garamond', fontBody: 'Libre Baskerville',
      animationStyle: 'elegant', animationSpeed: 'slow',
      decorativeElements: ['geometric-border', 'gold-particles'], musicEnabled: false,
    },
    'minimal-white': {
      background: { type: 'solid', value: '#fafafa' },
      primaryColor: '#1a1a1a', accentColor: '#888888', textColor: '#1a1a1a',
      fontHeading: 'Playfair Display', fontBody: 'Lato',
      animationStyle: 'minimal', animationSpeed: 'medium',
      decorativeElements: [], musicEnabled: false,
    },
    'floral-pink': {
      background: { type: 'gradient', value: 'linear-gradient(160deg,#fce4ec 0%,#f8bbd0 40%,#f48fb1 100%)' },
      primaryColor: '#c2185b', accentColor: '#e91e63', textColor: '#880e4f',
      fontHeading: 'Dancing Script', fontBody: 'Lato',
      animationStyle: 'elegant', animationSpeed: 'slow',
      decorativeElements: ['rose-petals', 'floral-border'], musicEnabled: false,
    },
    'dark-luxury': {
      background: { type: 'gradient', value: 'linear-gradient(180deg,#0a0a0a 0%,#1a1a2e 50%,#0a0a0a 100%)' },
      primaryColor: '#e8e8e8', accentColor: '#b8860b', textColor: '#f0f0f0',
      fontHeading: 'Cinzel', fontBody: 'Cormorant Garamond',
      animationStyle: 'elegant', animationSpeed: 'slow',
      decorativeElements: ['diamond-pattern', 'silver-sparkles'], musicEnabled: false,
    },
    'pastel-dream': {
      background: { type: 'gradient', value: 'linear-gradient(135deg,#e0f7fa 0%,#fce4ec 50%,#f3e5f5 100%)' },
      primaryColor: '#7b1fa2', accentColor: '#ff6f00', textColor: '#4a148c',
      fontHeading: 'Pacifico', fontBody: 'Nunito',
      animationStyle: 'playful', animationSpeed: 'medium',
      decorativeElements: ['stars', 'balloons'], musicEnabled: false,
    },
    'vibrant-festival': {
      background: { type: 'gradient', value: 'linear-gradient(135deg,#ff6b35 0%,#f7c59f 30%,#efefd0 60%,#004e89 100%)' },
      primaryColor: '#ff6b35', accentColor: '#f7c59f', textColor: '#ffffff',
      fontHeading: 'Righteous', fontBody: 'Nunito',
      animationStyle: 'vibrant', animationSpeed: 'fast',
      decorativeElements: ['fireworks', 'lanterns'], musicEnabled: false,
    },
    'corporate-blue': {
      background: { type: 'gradient', value: 'linear-gradient(160deg,#0d1b2a 0%,#1b2838 60%,#162032 100%)' },
      primaryColor: '#4fc3f7', accentColor: '#ffffff', textColor: '#e3f2fd',
      fontHeading: 'Montserrat', fontBody: 'Open Sans',
      animationStyle: 'minimal', animationSpeed: 'medium',
      decorativeElements: ['grid-pattern'], musicEnabled: false,
    },
    'rustic-wood': {
      background: { type: 'gradient', value: 'linear-gradient(180deg,#3e1c00 0%,#6d3a1f 50%,#4e2400 100%)' },
      primaryColor: '#d4a853', accentColor: '#f5deb3', textColor: '#faebd7',
      fontHeading: 'Abril Fatface', fontBody: 'Merriweather',
      animationStyle: 'elegant', animationSpeed: 'slow',
      decorativeElements: ['leaves', 'twine-border'], musicEnabled: false,
    },
    'starry-night': {
      background: { type: 'gradient', value: 'linear-gradient(180deg,#0a0520 0%,#1a0845 50%,#0a0520 100%)' },
      primaryColor: '#a78bfa', accentColor: '#c4b5fd', textColor: '#e9d5ff',
      fontHeading: 'Cormorant Garamond', fontBody: 'Lato',
      animationStyle: 'elegant', animationSpeed: 'slow',
      decorativeElements: ['animated-stars', 'moon'], musicEnabled: false,
    },
    'neon-party': {
      background: { type: 'gradient', value: 'linear-gradient(135deg,#0d0d0d 0%,#1a0030 50%,#0d0d0d 100%)' },
      primaryColor: '#ff00c8', accentColor: '#00e5ff', textColor: '#ffffff',
      fontHeading: 'Orbitron', fontBody: 'Exo 2',
      animationStyle: 'vibrant', animationSpeed: 'fast',
      decorativeElements: ['neon-glow', 'electric-lines'], musicEnabled: false,
    },
  }

  const templateConfig = THEME_CONFIGS[templateSlug] ?? THEME_CONFIGS['royal-gold']

  const previewData = {
    event: {
      ...DEMO_EVENT,
      title: config?.eventTitleOverride ?? DEMO_EVENT.title,
    },
    guestLink: {
      guest: { full_name: guestName },
      personalized_message: config?.customMessageTemplate ?? 'Looking forward to celebrating with you!',
      short_link: { code: 'preview' },
    },
    invitation: {
      template: { theme_slug: templateSlug, config: templateConfig },
      custom_config: config ?? {},
      is_published: true,
    },
  }

  return <InvitationViewer data={previewData as Parameters<typeof InvitationViewer>[0]['data']} previewMode />
}
