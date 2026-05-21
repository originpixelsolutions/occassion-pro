'use client'
/**
 * OccasionPro — Invitation Template Registry
 *
 * Maps theme_slug → React component that renders a full animated invitation.
 * Each template receives InvitationRenderProps and handles its own Framer Motion
 * animations, theming, and RSVP form rendering.
 */

export type RsvpStatus = 'attending' | 'not_attending' | null

export interface InvitationEvent {
  id: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  timezone?: string
  venue_name?: string
  venue_address?: string
  cover_image_url?: string
  workspace?: { name?: string; logo_url?: string }
}

export interface InvitationGuestLink {
  id: string
  personalized_message?: string | null
  is_opened: boolean
  guest?: {
    id?: string
    full_name: string
    email?: string
    phone?: string
  }
}

export interface TemplateConfig {
  background?: string
  primaryColor?: string
  accentColor?: string
  textColor?: string
  fontHeading?: string
  fontBody?: string
  animationStyle?: string
  animationSpeed?: 'slow' | 'normal' | 'fast'
  decorativeElements?: string[]
  musicEnabled?: boolean
  [key: string]: unknown
}

export interface InvitationRenderProps {
  /** Merged config: template defaults ← custom_config overrides */
  config: TemplateConfig
  event: InvitationEvent
  guestLink: InvitationGuestLink
  rsvpStatus: RsvpStatus
  onRsvp: (response: 'attending' | 'not_attending') => Promise<void>
  rsvpLoading: boolean
}

// Dynamic import wrappers so each template only loads when needed
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

const RoyalGold      = dynamic(() => import('./templates/RoyalGold'))
const MinimalWhite   = dynamic(() => import('./templates/MinimalWhite'))
const FloralPink     = dynamic(() => import('./templates/FloralPink'))
const DarkLuxury     = dynamic(() => import('./templates/DarkLuxury'))
const PastelDream    = dynamic(() => import('./templates/PastelDream'))
const VibrantFestival= dynamic(() => import('./templates/VibrantFestival'))
const CorporateBlue  = dynamic(() => import('./templates/CorporateBlue'))
const RusticWood     = dynamic(() => import('./templates/RusticWood'))
const StarryNight    = dynamic(() => import('./templates/StarryNight'))
const NeonParty      = dynamic(() => import('./templates/NeonParty'))

export const TEMPLATE_REGISTRY: Record<string, ComponentType<InvitationRenderProps>> = {
  'royal-gold':       RoyalGold      as ComponentType<InvitationRenderProps>,
  'minimal-white':    MinimalWhite   as ComponentType<InvitationRenderProps>,
  'floral-pink':      FloralPink     as ComponentType<InvitationRenderProps>,
  'dark-luxury':      DarkLuxury     as ComponentType<InvitationRenderProps>,
  'pastel-dream':     PastelDream    as ComponentType<InvitationRenderProps>,
  'vibrant-festival': VibrantFestival as ComponentType<InvitationRenderProps>,
  'corporate-blue':   CorporateBlue  as ComponentType<InvitationRenderProps>,
  'rustic-wood':      RusticWood     as ComponentType<InvitationRenderProps>,
  'starry-night':     StarryNight    as ComponentType<InvitationRenderProps>,
  'neon-party':       NeonParty      as ComponentType<InvitationRenderProps>,
}

/** Merge template default config with tenant custom_config overrides */
export function mergeConfig(
  templateConfig: Record<string, unknown>,
  customConfig: Record<string, unknown>,
): TemplateConfig {
  return { ...templateConfig, ...customConfig } as TemplateConfig
}

/** Returns the correct component or a fallback if slug not found */
export function getTemplateComponent(
  themeSlug: string,
): ComponentType<InvitationRenderProps> {
  return TEMPLATE_REGISTRY[themeSlug] ?? TEMPLATE_REGISTRY['minimal-white']
}
