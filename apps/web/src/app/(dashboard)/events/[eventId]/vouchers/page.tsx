'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  FileText, Download, Send, Eye, Palette, Settings2, ChevronRight,
  RefreshCw, Check, X, Star, Building2, Calendar, Bed, Users,
  Mail, Smartphone, Copy, Printer, Sparkles, LayoutTemplate,
  Layers, QrCode, Globe, ArrowLeft, CheckCircle2, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string
  check_in_date: string
  check_out_date: string
  status: string
  special_requests?: string
  voucher_sent: boolean
  hotels?: { id: string; name: string; star_rating?: number; address?: string; city?: string; phone?: string }
  hotel_rooms?: { id: string; room_number: string; room_type: string; capacity: number; floor?: number }
  guests?: { id: string; full_name: string; email?: string; phone?: string; category?: string }
}

interface VoucherTemplate {
  id: string
  name: string
  description: string
  preview: string // CSS class group
}

interface VoucherDesign {
  template: string
  primaryColor: string
  accentColor: string
  bgColor: string
  fontFamily: string
  showQrCode: boolean
  showLogo: boolean
  showStars: boolean
  showRoomDetails: boolean
  showSpecialRequests: boolean
  showContactInfo: boolean
  headerText: string
  footerText: string
  organizerName: string
  organizerLogo?: string
  borderRadius: 'sharp' | 'default' | 'rounded'
}

const TEMPLATES: VoucherTemplate[] = [
  { id: 'classic', name: 'Classic', description: 'Elegant and formal', preview: 'bg-white text-gray-900' },
  { id: 'modern', name: 'Modern', description: 'Bold and contemporary', preview: 'bg-slate-900 text-white' },
  { id: 'minimal', name: 'Minimal', description: 'Clean and simple', preview: 'bg-gray-50 text-gray-800' },
  { id: 'luxury', name: 'Luxury', description: 'Premium gold finish', preview: 'bg-stone-900 text-amber-100' },
]

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Default)' },
  { value: 'Georgia, serif', label: 'Georgia (Serif)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: '"DM Sans", sans-serif', label: 'DM Sans' },
]

const DEFAULT_DESIGN: VoucherDesign = {
  template: 'classic',
  primaryColor: '#4f46e5',
  accentColor: '#818cf8',
  bgColor: '#ffffff',
  fontFamily: 'Inter',
  showQrCode: true,
  showLogo: true,
  showStars: true,
  showRoomDetails: true,
  showSpecialRequests: true,
  showContactInfo: true,
  headerText: 'ACCOMMODATION VOUCHER',
  footerText: 'Please present this voucher at check-in. Valid for the dates specified above.',
  organizerName: 'OccasionPro Events',
  borderRadius: 'default',
}

// ─── Voucher HTML Generator ───────────────────────────────────────────────────

function generateVoucherHTML(booking: Booking, design: VoucherDesign, eventName?: string): string {
  const { template, primaryColor, accentColor, bgColor, fontFamily } = design
  const br = design.borderRadius === 'sharp' ? '0' : design.borderRadius === 'rounded' ? '16px' : '8px'

  const isModern = template === 'modern'
  const isLuxury = template === 'luxury'
  const isMinimal = template === 'minimal'

  // Template-specific colors
  const bg = isModern ? '#0f172a' : isLuxury ? '#1c1407' : isMinimal ? '#f8fafc' : bgColor
  const text = isModern || isLuxury ? '#f1f5f9' : '#0f172a'
  const subtext = isModern ? '#94a3b8' : isLuxury ? '#d4b896' : '#64748b'
  const border = isModern ? '#1e293b' : isLuxury ? '#3d2e0a' : '#e2e8f0'
  const accent = isLuxury ? '#d4a853' : accentColor
  const headerBg = isModern ? primaryColor : isLuxury ? '#d4a853' : isMinimal ? 'transparent' : primaryColor
  const headerText = (isModern || isLuxury || !isMinimal) ? '#ffffff' : primaryColor
  const dividerColor = isLuxury ? '#d4a853' : isMinimal ? '#e2e8f0' : primaryColor

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
  const nights = booking.check_in_date && booking.check_out_date
    ? Math.ceil((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 86400000)
    : 0

  const refNum = booking.id.slice(0, 8).toUpperCase()

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${fontFamily}, -apple-system, sans-serif; background: ${bg}; color: ${text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .voucher { width: 794px; min-height: 560px; background: ${bg}; border-radius: ${br}; overflow: hidden; position: relative; }
  ${isLuxury ? `.voucher::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 2px solid #d4a85344; border-radius: ${br}; pointer-events: none; z-index: 10; }` : ''}

  /* Header */
  .header { background: ${isMinimal ? 'transparent' : headerBg}; padding: ${isMinimal ? '24px 32px 16px' : '28px 32px'}; display: flex; align-items: center; justify-content: space-between; ${isMinimal ? 'border-bottom: 2px solid ' + dividerColor + ';' : ''} }
  .header-left { }
  .header-label { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: ${isMinimal ? accent : 'rgba(255,255,255,0.7)'}; margin-bottom: 4px; font-weight: 600; }
  .header-title { font-size: ${isLuxury ? '22px' : '18px'}; font-weight: 700; color: ${isMinimal ? primaryColor : headerText}; ${isLuxury ? 'letter-spacing: 1px;' : ''} }
  .ref-badge { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 600; color: ${isMinimal ? subtext : 'rgba(255,255,255,0.9)'}; letter-spacing: 1px; ${isMinimal ? 'background: ' + bg + '; border: 1px solid ' + border + ';' : ''} }

  /* Body */
  .body { padding: 28px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .section-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: ${subtext}; font-weight: 700; margin-bottom: 8px; }
  .section-value { font-size: 15px; font-weight: 600; color: ${text}; line-height: 1.4; }
  .section-sub { font-size: 12px; color: ${subtext}; margin-top: 3px; }

  /* Hotel block */
  .hotel-block { grid-column: span 2; padding: 16px 20px; background: ${isModern ? 'rgba(255,255,255,0.05)' : isLuxury ? 'rgba(212,168,83,0.08)' : 'rgba(0,0,0,0.03)'}; border-radius: 8px; border: 1px solid ${isLuxury ? 'rgba(212,168,83,0.2)' : border}; display: flex; align-items: center; gap: 20px; }
  .hotel-icon { width: 44px; height: 44px; border-radius: 10px; background: ${isLuxury ? 'rgba(212,168,83,0.15)' : 'rgba(79,70,229,0.1)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px; }
  .hotel-name { font-size: 17px; font-weight: 700; color: ${text}; }
  .hotel-address { font-size: 12px; color: ${subtext}; margin-top: 3px; }
  .stars { display: flex; gap: 3px; margin-top: 5px; }
  .star { width: 11px; height: 11px; color: ${isLuxury ? '#d4a853' : '#f59e0b'}; }

  /* Date blocks */
  .dates-grid { grid-column: span 2; display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; }
  .date-block { padding: 14px 18px; background: ${isModern ? 'rgba(255,255,255,0.05)' : isLuxury ? 'rgba(212,168,83,0.08)' : bgColor}; border: 1px solid ${border}; border-radius: 8px; text-align: center; }
  .date-block.checkin { border-color: ${primaryColor}44; }
  .date-block.checkout { border-color: ${accent}44; }
  .date-type { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: ${subtext}; font-weight: 700; margin-bottom: 6px; }
  .date-day { font-size: 26px; font-weight: 800; color: ${text}; line-height: 1; }
  .date-full { font-size: 11px; color: ${subtext}; margin-top: 4px; }
  .nights-pill { background: ${isLuxury ? 'rgba(212,168,83,0.2)' : primaryColor + '15'}; border: 1px solid ${isLuxury ? 'rgba(212,168,83,0.3)' : primaryColor + '33'}; border-radius: 99px; padding: 8px 16px; text-align: center; }
  .nights-num { font-size: 20px; font-weight: 800; color: ${isLuxury ? '#d4a853' : primaryColor}; }
  .nights-label { font-size: 10px; color: ${subtext}; margin-top: 2px; }

  /* Footer */
  .footer { border-top: 1px solid ${border}; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: ${isModern ? 'rgba(255,255,255,0.02)' : isLuxury ? 'rgba(212,168,83,0.05)' : 'rgba(0,0,0,0.02)'}; }
  .footer-text { font-size: 10px; color: ${subtext}; max-width: 480px; line-height: 1.5; }
  .qr-box { width: 56px; height: 56px; border-radius: 6px; background: ${isModern ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid ${border}; }
  .qr-inner { display: grid; grid-template-columns: repeat(5,1fr); gap: 2px; padding: 6px; }
  .qr-cell { width: 6px; height: 6px; background: ${isModern ? '#fff' : '#1e293b'}; border-radius: 1px; }

  .tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 1px; }
  .tag-room { background: ${isLuxury ? 'rgba(212,168,83,0.15)' : primaryColor + '15'}; color: ${isLuxury ? '#d4a853' : primaryColor}; border: 1px solid ${isLuxury ? 'rgba(212,168,83,0.3)' : primaryColor + '30'}; }

  @media print {
    body { background: white; }
    .voucher { width: 100%; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="voucher">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="header-label">${design.organizerName}</div>
      <div class="header-title">${design.headerText}</div>
    </div>
    <div class="ref-badge">REF: ${refNum}</div>
  </div>

  <!-- Body -->
  <div class="body">
    <!-- Guest section -->
    <div>
      <div class="section-label">Guest Name</div>
      <div class="section-value">${booking.guests?.full_name ?? 'Guest'}</div>
      ${booking.guests?.category ? `<div class="section-sub" style="text-transform:capitalize">${booking.guests.category}</div>` : ''}
    </div>

    <!-- Event section -->
    <div>
      <div class="section-label">Event</div>
      <div class="section-value">${eventName ?? 'Event'}</div>
    </div>

    <!-- Hotel block -->
    <div class="hotel-block">
      <div class="hotel-icon">🏨</div>
      <div style="flex:1">
        <div class="hotel-name">${booking.hotels?.name ?? 'Hotel'}</div>
        ${(booking.hotels?.address || booking.hotels?.city) ? `<div class="hotel-address">${[booking.hotels?.address, booking.hotels?.city].filter(Boolean).join(', ')}</div>` : ''}
        ${design.showStars && booking.hotels?.star_rating ? `
        <div class="stars">
          ${'<svg class="star" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'.repeat(booking.hotels.star_rating)}
        </div>` : ''}
      </div>
      ${design.showRoomDetails && booking.hotel_rooms ? `
      <div style="text-align:right">
        <div class="tag tag-room">Room ${booking.hotel_rooms.room_number}</div>
        <div class="section-sub" style="margin-top:6px;text-transform:capitalize">${booking.hotel_rooms.room_type}</div>
        <div class="section-sub">Capacity: ${booking.hotel_rooms.capacity}</div>
      </div>` : ''}
    </div>

    <!-- Dates -->
    <div class="dates-grid">
      <div class="date-block checkin">
        <div class="date-type">Check-In</div>
        <div class="date-day">${new Date(booking.check_in_date).getDate()}</div>
        <div class="date-full">${formatDate(booking.check_in_date)}</div>
      </div>
      <div class="nights-pill">
        <div class="nights-num">${nights}</div>
        <div class="nights-label">Night${nights !== 1 ? 's' : ''}</div>
      </div>
      <div class="date-block checkout">
        <div class="date-type">Check-Out</div>
        <div class="date-day">${new Date(booking.check_out_date).getDate()}</div>
        <div class="date-full">${formatDate(booking.check_out_date)}</div>
      </div>
    </div>

    <!-- Special requests -->
    ${design.showSpecialRequests && booking.special_requests ? `
    <div style="grid-column:span 2; padding: 12px 16px; background: ${isModern ? 'rgba(255,255,255,0.04)' : isLuxury ? 'rgba(212,168,83,0.05)' : 'rgba(0,0,0,0.02)'}; border-radius: 8px; border: 1px solid ${border};">
      <div class="section-label">Special Requests</div>
      <div style="font-size:13px;color:${subtext};margin-top:4px;line-height:1.5">${booking.special_requests}</div>
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-text">${design.footerText}</div>
    ${design.showQrCode ? `
    <div class="qr-box" title="Booking reference QR">
      <div class="qr-inner">
        ${Array.from({length:25}).map((_,i) => `<div class="qr-cell" style="opacity:${Math.random() > 0.4 ? 1 : 0}"></div>`).join('')}
      </div>
    </div>` : ''}
  </div>
</div>
</body>
</html>`
}

// ─── Voucher Preview ──────────────────────────────────────────────────────────

interface VoucherPreviewProps {
  booking: Booking | null
  design: VoucherDesign
  eventName?: string
  scale?: number
}

function VoucherPreview({ booking, design, eventName, scale = 0.7 }: VoucherPreviewProps) {
  if (!booking) {
    return (
      <div className="flex items-center justify-center h-64 bg-white/[0.02] border border-white/10 rounded-xl text-slate-500 text-sm">
        Select a booking to preview voucher
      </div>
    )
  }

  const html = generateVoucherHTML(booking, design, eventName)

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10" style={{ background: '#1a1a2e' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%`, pointerEvents: 'none' }}>
        <iframe
          srcDoc={html}
          style={{ width: '794px', height: '600px', border: 'none', display: 'block' }}
          title="Voucher Preview"
        />
      </div>
    </div>
  )
}

// ─── Download Logic ───────────────────────────────────────────────────────────

function downloadVoucher(booking: Booking, design: VoucherDesign, eventName?: string) {
  const html = generateVoucherHTML(booking, design, eventName)
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 500)
}

function downloadAllVouchers(bookings: Booking[], design: VoucherDesign, eventName?: string) {
  const allHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .page { page-break-after: always; padding: 20px; }
    .page:last-child { page-break-after: avoid; }
    @media print { body { margin: 0; } }
  </style></head><body>
  ${bookings.map(b => `<div class="page">${generateVoucherHTML(b, design, eventName).replace(/<!DOCTYPE html>[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*?<\/html>/, '')}</div>`).join('')}
  </body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(allHtml)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 600)
}

// ─── Design Panel ─────────────────────────────────────────────────────────────

interface DesignPanelProps {
  design: VoucherDesign
  onChange: (d: VoucherDesign) => void
}

function DesignPanel({ design, onChange }: DesignPanelProps) {
  const set = (k: keyof VoucherDesign, v: any) => onChange({ ...design, [k]: v })

  return (
    <div className="space-y-5 overflow-y-auto pr-1">
      {/* Templates */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Template</div>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => set('template', t.id)}
              className={cn(
                'p-3 rounded-xl border text-left transition-all',
                design.template === t.id
                  ? 'border-indigo-500/50 bg-indigo-600/10 ring-1 ring-indigo-500/30'
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              )}
            >
              <div className={cn('w-full h-8 rounded-md mb-2', t.preview)} />
              <div className="text-xs font-semibold text-white">{t.name}</div>
              <div className="text-[10px] text-slate-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Colors</div>
        <div className="space-y-2">
          {[
            { label: 'Primary', key: 'primaryColor' as const },
            { label: 'Accent', key: 'accentColor' as const },
            { label: 'Background', key: 'bgColor' as const },
          ].map(c => (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{c.label}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="w-6 h-6 rounded border border-white/20" style={{ background: design[c.key] as string }} />
                <input
                  type="color"
                  value={design[c.key] as string}
                  onChange={e => set(c.key, e.target.value)}
                  className="sr-only"
                />
                <span className="text-xs text-slate-500 font-mono">{(design[c.key] as string).toUpperCase()}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Typography</div>
        <select
          value={design.fontFamily}
          onChange={e => set('fontFamily', e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Border radius */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Border Radius</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['sharp', 'default', 'rounded'] as const).map(r => (
            <button
              key={r}
              onClick={() => set('borderRadius', r)}
              className={cn(
                'py-1.5 text-xs capitalize rounded-lg border transition-colors',
                design.borderRadius === r
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Content toggles */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Sections</div>
        <div className="space-y-1.5">
          {[
            { key: 'showQrCode' as const, label: 'QR Code' },
            { key: 'showStars' as const, label: 'Star Rating' },
            { key: 'showRoomDetails' as const, label: 'Room Details' },
            { key: 'showSpecialRequests' as const, label: 'Special Requests' },
          ].map(t => (
            <div key={t.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/5">
              <span className="text-xs text-slate-300">{t.label}</span>
              <button
                onClick={() => set(t.key, !design[t.key])}
                className={cn(
                  'w-9 h-5 rounded-full transition-colors relative',
                  design[t.key] ? 'bg-indigo-600' : 'bg-white/20'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  design[t.key] ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Text</div>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Header Text</label>
            <input
              value={design.headerText}
              onChange={e => set('headerText', e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Organizer Name</label>
            <input
              value={design.organizerName}
              onChange={e => set('organizerName', e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Footer Note</label>
            <textarea
              value={design.footerText}
              onChange={e => set('footerText', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VouchersPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { session } = useAuth()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingCount, setBookingCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [voucherFilter, setVoucherFilter] = useState<string>('all')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [design, setDesign] = useState<VoucherDesign>(DEFAULT_DESIGN)
  const [activePanel, setActivePanel] = useState<'design' | 'content'>('design')
  const [eventName, setEventName] = useState<string>()
  const [sending, setSending] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${session?.access_token}`,
    'x-tenant-id': session?.user?.user_metadata?.tenant_id ?? '',
  }), [session])

  useEffect(() => {
    if (!session) return
    // Load event name
    fetch(`${API}/events/${eventId}`, { headers })
      .then(r => r.json())
      .then(d => setEventName(d?.name))
      .catch(() => {})
  }, [session, eventId])

  const loadBookings = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const r = await fetch(`${API}/accommodation/events/${eventId}/bookings?${params}`, { headers })
    const d = await r.json()
    let list = Array.isArray(d.data) ? d.data : []
    if (voucherFilter === 'sent') list = list.filter((b: Booking) => b.voucher_sent)
    if (voucherFilter === 'unsent') list = list.filter((b: Booking) => !b.voucher_sent)
    setBookings(list)
    setBookingCount(d.count ?? 0)
    setLoading(false)
  }, [session, page, statusFilter, voucherFilter, eventId, headers])

  useEffect(() => { loadBookings() }, [loadBookings])

  const handleMarkVoucherSent = async (id: string) => {
    setSending(id)
    await fetch(`${API}/accommodation/bookings/${id}/mark-voucher-sent`, { method: 'POST', headers })
    setSending(null)
    loadBookings()
  }

  const handleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bookings.map(b => b.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedBookings = bookings.filter(b => selectedIds.has(b.id))

  const handleDownloadSelected = () => {
    if (selectedBookings.length === 1) {
      downloadVoucher(selectedBookings[0], design, eventName)
    } else if (selectedBookings.length > 1) {
      downloadAllVouchers(selectedBookings, design, eventName)
    }
  }

  const handleDownloadAll = () => {
    if (bookings.length === 1) {
      downloadVoucher(bookings[0], design, eventName)
    } else {
      downloadAllVouchers(bookings, design, eventName)
    }
  }

  const totalSent = bookings.filter(b => b.voucher_sent).length
  const totalUnsent = bookings.filter(b => !b.voucher_sent).length

  return (
    <div className="min-h-screen bg-[#080a0e] text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/events/${eventId}`} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
              <ChevronRight size={16} className="rotate-180" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText size={18} className="text-violet-400" />
                Voucher Generator
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Design and distribute accommodation vouchers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleDownloadSelected}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg text-sm hover:bg-violet-600/30 transition-colors"
              >
                <Download size={14} /> Download {selectedIds.size} Selected
              </button>
            )}
            <button
              onClick={handleDownloadAll}
              disabled={bookings.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              <Printer size={14} /> Print All Vouchers
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Design Panel */}
        <div className="w-72 shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b border-white/10">
            {(['design', 'content'] as const).map(p => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                className={cn(
                  'flex-1 py-3 text-xs font-medium capitalize transition-colors',
                  activePanel === p ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'
                )}
              >
                {p === 'design' ? '🎨 Design' : '📋 Content'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <DesignPanel design={design} onChange={setDesign} />
          </div>
        </div>

        {/* Center: Preview + Bookings */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats strip */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-white/10 bg-white/[0.01] shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-500">{bookingCount} total</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-400">{totalSent} vouchers sent</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-400">{totalUnsent} pending</span>
            </div>

            {/* Filters */}
            <div className="ml-auto flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
              </select>
              <select
                value={voucherFilter}
                onChange={e => setVoucherFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="all">All Vouchers</option>
                <option value="sent">Sent</option>
                <option value="unsent">Not Sent</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex gap-0">
            {/* Bookings list */}
            <div className="w-80 shrink-0 border-r border-white/10 overflow-y-auto">
              {/* Select all */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 sticky top-0 bg-[#080a0e] z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === bookings.length && bookings.length > 0}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded accent-indigo-500"
                />
                <span className="text-xs text-slate-500">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={18} className="animate-spin text-slate-500" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm px-4">
                  No bookings found. Create bookings in Accommodation to generate vouchers.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {bookings.map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                        selectedBooking?.id === b.id ? 'bg-white/8' : 'hover:bg-white/5'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(b.id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(b.id) }}
                        className="w-3.5 h-3.5 rounded accent-indigo-500 mt-0.5 shrink-0"
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm text-white font-medium truncate">{b.guests?.full_name ?? 'Guest'}</span>
                          {b.voucher_sent && <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{b.hotels?.name}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {new Date(b.check_in_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                          {new Date(b.check_out_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); downloadVoucher(b, design, eventName) }}
                          className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-md transition-colors"
                          title="Download voucher"
                        >
                          <Download size={12} />
                        </button>
                        {!b.voucher_sent && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMarkVoucherSent(b.id) }}
                            disabled={sending === b.id}
                            className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                            title="Mark as voucher sent"
                          >
                            {sending === b.id ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {bookingCount > 20 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 sticky bottom-0 bg-[#080a0e]">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="text-xs text-slate-500 hover:text-white disabled:opacity-40">← Prev</button>
                  <span className="text-xs text-slate-600">{page} / {Math.ceil(bookingCount / 20)}</span>
                  <button disabled={page >= Math.ceil(bookingCount / 20)} onClick={() => setPage(p => p + 1)}
                    className="text-xs text-slate-500 hover:text-white disabled:opacity-40">Next →</button>
                </div>
              )}
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedBooking ? (
                <div className="space-y-4">
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white flex-1">
                      Preview — {selectedBooking.guests?.full_name}
                    </span>
                    <button
                      onClick={() => downloadVoucher(selectedBooking, design, eventName)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs hover:bg-violet-600/30 transition-colors"
                    >
                      <Printer size={12} /> Print / Save PDF
                    </button>
                    {!selectedBooking.voucher_sent && (
                      <button
                        onClick={() => handleMarkVoucherSent(selectedBooking.id)}
                        disabled={sending === selectedBooking.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs hover:bg-emerald-600/30 disabled:opacity-40 transition-colors"
                      >
                        {sending === selectedBooking.id
                          ? <RefreshCw size={12} className="animate-spin" />
                          : <Check size={12} />
                        }
                        Mark Voucher Sent
                      </button>
                    )}
                    {selectedBooking.voucher_sent && (
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 text-emerald-400 rounded-lg text-xs border border-emerald-500/20">
                        <CheckCircle2 size={12} /> Voucher Sent
                      </div>
                    )}
                  </div>

                  {/* Live preview */}
                  <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e]">
                    <div style={{ transform: 'scale(0.72)', transformOrigin: 'top left', width: `${100/0.72}%`, pointerEvents: 'none' }}>
                      <iframe
                        key={`${selectedBooking.id}-${JSON.stringify(design)}`}
                        srcDoc={generateVoucherHTML(selectedBooking, design, eventName)}
                        style={{ width: '794px', height: '600px', border: 'none', display: 'block' }}
                        title="Voucher Preview"
                      />
                    </div>
                  </div>

                  {/* Booking details */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Guest', value: selectedBooking.guests?.full_name, sub: selectedBooking.guests?.category },
                      { label: 'Hotel', value: selectedBooking.hotels?.name, sub: selectedBooking.hotels?.city },
                      { label: 'Room', value: `#${selectedBooking.hotel_rooms?.room_number}`, sub: selectedBooking.hotel_rooms?.room_type },
                    ].map(d => (
                      <div key={d.label} className="p-3 bg-white/[0.03] border border-white/10 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{d.label}</div>
                        <div className="text-sm font-medium text-white">{d.value}</div>
                        {d.sub && <div className="text-xs text-slate-500 capitalize mt-0.5">{d.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <FileText size={28} className="text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Select a Booking</h3>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Click any booking from the list to preview its voucher. Use the design panel to customize the template.
                    </p>
                  </div>
                  {bookings.length > 0 && (
                    <button
                      onClick={() => setSelectedBooking(bookings[0])}
                      className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-sm hover:bg-indigo-600/30 transition-colors"
                    >
                      Preview First Voucher
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
