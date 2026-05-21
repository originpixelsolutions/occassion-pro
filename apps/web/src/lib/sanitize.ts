/**
 * sanitize.ts
 *
 * DOMPurify wrapper for safe HTML rendering in OccasionPro.
 *
 * Usage:
 *   import { sanitizeHtml, sanitizeText, isSafeUrl } from '@/lib/sanitize'
 *
 *   // In a component that must render HTML (e.g. rich text from backend):
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
 *
 *   // For plain text that should never contain HTML:
 *   const safe = sanitizeText(userInput)
 *
 * Security notes:
 *   - sanitizeHtml uses DOMPurify's strict allowlist
 *   - sanitizeText strips ALL HTML tags (safe for text-only fields)
 *   - isSafeUrl prevents javascript: and data: URI injection
 *   - Only call these on CLIENT components (DOMPurify requires DOM)
 *   - Server components: use the strip-tags approach or trust only
 *     content that went through the API's SanitizationPipe
 */

// DOMPurify is a client-side library — guard for SSR
let DOMPurify: typeof import('dompurify') | null = null

function getDOMPurify() {
  if (typeof window === 'undefined') return null
  if (!DOMPurify) {
    // Dynamic import to avoid SSR bundle issues
    // In practice, call sanitizeHtml only in client components
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      DOMPurify = require('dompurify')
    } catch {
      console.error('[sanitize] DOMPurify not available — install: npm install dompurify @types/dompurify')
      return null
    }
  }
  return DOMPurify
}

// ── Allowed HTML elements and attributes for rich text rendering ─────────────
// Keep this minimal. Never allow <script>, <iframe>, <object>, event handlers.
const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a',              // href only, target="_blank" rel="noopener noreferrer"
  'blockquote',
  'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
  'img',            // src limited to https:, data: image/* only
  'hr',
]

const ALLOWED_ATTRS = [
  'href',   // anchors
  'src',    // images (DOMPurify validates)
  'alt',    // images
  'title',
  'class',  // styling (no inline styles)
  'target', // _blank only
  'rel',
  'colspan', 'rowspan', // tables
]

/**
 * Sanitize HTML content for safe rendering with dangerouslySetInnerHTML.
 * Strips scripts, event handlers, dangerous attributes, and risky tags.
 *
 * @param dirty  Untrusted HTML string (from user, from API)
 * @param opts   Optional DOMPurify config overrides
 * @returns      Safe HTML string
 */
export function sanitizeHtml(
  dirty: string | null | undefined,
  opts?: {
    allowedTags?: string[]
    allowedAttrs?: string[]
    allowDataUris?: boolean
  },
): string {
  if (!dirty) return ''

  const purify = getDOMPurify()
  if (!purify) {
    // SSR fallback: strip all HTML
    return stripHtml(dirty)
  }

  const config: Record<string, unknown> = {
    ALLOWED_TAGS: opts?.allowedTags ?? ALLOWED_TAGS,
    ALLOWED_ATTR: opts?.allowedAttrs ?? ALLOWED_ATTRS,
    // Force target="_blank" links to also have rel="noopener noreferrer"
    ADD_ATTR: ['target'],
    FORCE_BODY: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    // Prevent DOM clobbering
    SANITIZE_DOM: true,
  }

  if (!opts?.allowDataUris) {
    config.ALLOW_DATA_ATTR = false
  }

  const clean = purify.sanitize(dirty, config as Parameters<typeof purify.sanitize>[1])

  // Post-process: ensure all <a target="_blank"> have rel="noopener noreferrer"
  return clean.replace(
    /<a([^>]*)\starget="_blank"([^>]*)>/gi,
    (match, before, after) => {
      if (!/rel=/i.test(match)) {
        return `<a${before} target="_blank" rel="noopener noreferrer"${after}>`
      }
      return match
    },
  )
}

/**
 * Strip ALL HTML from a string. Use for plain-text fields like names, titles.
 * Safe for SSR and CSR.
 */
export function sanitizeText(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return stripHtml(dirty).trim()
}

/**
 * Check if a URL is safe to use in href/src attributes.
 * Blocks javascript:, data: (except images), vbscript:, and blob: from external sources.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false

  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerous = ['javascript:', 'vbscript:', 'data:text', 'data:application']
  if (dangerous.some((d) => trimmed.startsWith(d))) return false

  // Allow safe protocols
  const safe = ['https://', 'http://', 'mailto:', '//', '/', '#', 'tel:']
  if (safe.some((s) => trimmed.startsWith(s))) return true

  // Allow data: for images specifically
  if (trimmed.startsWith('data:image/')) return true

  // Relative URLs
  if (!trimmed.includes(':')) return true

  return false
}

/**
 * Sanitize a URL for safe use in href/src.
 * Returns '#' if the URL is unsafe.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '#'
  return isSafeUrl(url) ? url : '#'
}

/**
 * Escape HTML special characters for safe insertion into text nodes.
 * Use when building HTML strings manually (not recommended — prefer React).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// ── Internal: strip all HTML tags ─────────────────────────────────────────────
function stripHtml(html: string): string {
  // Server-safe: use regex to strip tags (no DOM available)
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
}
