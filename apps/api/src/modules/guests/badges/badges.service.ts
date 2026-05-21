import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import * as QRCode from 'qrcode'
import {
  PDFDocument,
  PDFPage,
  rgb,
  StandardFonts,
  PDFFont,
  degrees,
} from 'pdf-lib'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BadgeTemplate {
  layout?: '6up' | '8up' | 'avery5160' | '1up'
  paper_size?: 'A4' | 'Letter'
  orientation?: 'landscape' | 'portrait'
  show_fields?: Array<
    'guest_name' | 'category' | 'table' | 'company' | 'qr_code' | 'event_name' | 'logo'
  >
  primary_color?: string   // hex e.g. "#7c3aed"
  secondary_color?: string
  text_color?: string
  font_family?: 'Helvetica' | 'Times-Roman' | 'Courier'
  logo_url?: string
  background_url?: string
}

interface GuestRow {
  id: string
  full_name: string
  email?: string
  table_no?: string | number
  qr_code?: string
  company?: string
  designation?: string
  guest_categories?: { name: string; color?: string } | null
}

interface EventRow {
  id: string
  name: string
  badge_template?: BadgeTemplate | null
}

// ─── Layout constants (all in PDF points, 1pt = 1/72 inch) ───────────────────

const PAGE_SIZES = {
  A4:     { w: 595.28, h: 841.89 },
  Letter: { w: 612,    h: 792    },
}

// Badge cell dimensions per layout (w × h in points)
const LAYOUTS: Record<string, { cols: number; rows: number; badgeW: number; badgeH: number; padX: number; padY: number }> = {
  '6up':       { cols: 2, rows: 3, badgeW: 252, badgeH: 180, padX: 45, padY: 30 },
  '8up':       { cols: 2, rows: 4, badgeW: 252, badgeH: 138, padX: 45, padY: 18 },
  'avery5160': { cols: 3, rows: 10, badgeW: 190, badgeH: 72, padX: 8,  padY: 5  },
  '1up':       { cols: 1, rows: 1, badgeW: 468, badgeH: 288, padX: 63, padY: 63 },
}

// ─── Hex → rgb (0–1 range) ────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BadgesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly emitter: EventEmitter2,
  ) {}

  // ─── QR code helper ─────────────────────────────────────────────────────────

  async generateQrCode(guestId: string, tenantId: string, token: string): Promise<string> {
    const client = this.supabase.forRequest(token)
    const { data: guest } = await client
      .from('guests')
      .select('qr_code')
      .eq('id', guestId)
      .eq('tenant_id', tenantId)
      .single()

    if (!guest) throw new Error('Guest not found')
    const qrDataUrl = await QRCode.toDataURL(guest.qr_code ?? guestId, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    })
    return qrDataUrl
  }

  // ─── Badge template CRUD ────────────────────────────────────────────────────

  async getTemplates(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('badge_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // ─── Get/save badge_template on event ───────────────────────────────────────

  async getBadgeConfig(eventId: string, tenantId: string, token: string): Promise<BadgeTemplate> {
    const client = this.supabase.forRequest(token)
    const { data } = await client
      .from('events')
      .select('badge_template')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .single()
    return (data?.badge_template ?? {}) as BadgeTemplate
  }

  async saveBadgeConfig(
    eventId: string,
    tenantId: string,
    config: BadgeTemplate,
    token: string,
  ): Promise<BadgeTemplate> {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('events')
      .update({ badge_template: config })
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .select('badge_template')
      .single()
    if (error) throw new Error(error.message)
    return (data?.badge_template ?? {}) as BadgeTemplate
  }

  // ─── Print queue ────────────────────────────────────────────────────────────

  async queueBadgePrint(
    guestId: string,
    eventId: string,
    tenantId: string,
    zoneId: string | undefined,
    triggeredBy: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)

    const { data: guest } = await client
      .from('guests')
      .select('category_id')
      .eq('id', guestId)
      .single()

    let templateQuery = client
      .from('badge_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .eq('is_default', true)

    if (guest?.category_id) {
      templateQuery = client
        .from('badge_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('event_id', eventId)
        .eq('category_id', guest.category_id)
    }

    const { data: template } = await templateQuery.limit(1).single()

    const { data: queueEntry, error } = await client
      .from('badge_print_queue')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        guest_id: guestId,
        template_id: template?.id ?? null,
        zone_id: zoneId ?? null,
        status: 'queued',
        triggered_by: triggeredBy,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    this.emitter.emit('badge.queued', queueEntry)
    return queueEntry
  }

  async getPrintQueue(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('badge_print_queue')
      .select(`*, guests(id, full_name, company, designation)`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async updatePrintStatus(
    queueId: string,
    status: string,
    printerId: string | undefined,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)
    const update: any = {
      status,
      ...(status === 'printed' ? { printed_at: new Date().toISOString() } : {}),
      ...(printerId ? { printer_id: printerId } : {}),
    }
    const { data, error } = await client
      .from('badge_print_queue')
      .update(update)
      .eq('id', queueId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // ─── PDF GENERATION ─────────────────────────────────────────────────────────

  /**
   * Generate a printable badge PDF for all (or selected) guests in an event.
   * Layout, colours, and visible fields are driven by events.badge_template JSONB.
   */
  async generateBadgesPdf(
    eventId: string,
    tenantId: string,
    token: string,
    guestIds?: string[],   // if supplied, only those guests; else all
  ): Promise<Uint8Array> {
    const client = this.supabase.forRequest(token)

    // 1. Fetch event + template config
    const { data: event, error: evErr } = await client
      .from('events')
      .select('id, name, badge_template')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (evErr || !event) throw new Error('Event not found')
    const cfg: BadgeTemplate = (event.badge_template ?? {}) as BadgeTemplate

    // 2. Fetch guests
    let guestQuery = client
      .from('guests')
      .select(`
        id, full_name, email, table_no, qr_code, company, designation,
        guest_categories(name, color)
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('full_name')

    if (guestIds?.length) {
      guestQuery = guestQuery.in('id', guestIds)
    }

    const { data: guests, error: gErr } = await guestQuery
    if (gErr) throw new Error(gErr.message)
    if (!guests?.length) throw new Error('No guests found for this event')

    // 3. Build PDF
    return this._buildPdf(event as EventRow, guests as GuestRow[], cfg)
  }

  // ─── Internal PDF builder ────────────────────────────────────────────────────

  private async _buildPdf(
    event: EventRow,
    guests: GuestRow[],
    cfg: BadgeTemplate,
  ): Promise<Uint8Array> {
    const paperKey = cfg.paper_size ?? 'A4'
    const layoutKey = cfg.layout ?? '6up'
    const layout = LAYOUTS[layoutKey] ?? LAYOUTS['6up']
    const paper = PAGE_SIZES[paperKey]

    // Orientation
    const isLandscape = cfg.orientation === 'landscape'
    const pageW = isLandscape ? paper.h : paper.w
    const pageH = isLandscape ? paper.w : paper.h

    // Colors
    const primary   = hexToRgb(cfg.primary_color ?? '#7c3aed')
    const secondary = hexToRgb(cfg.secondary_color ?? '#f5f3ff')
    const textCol   = hexToRgb(cfg.text_color ?? '#1a1a2e')

    // Visible fields
    const show = new Set<string>(
      cfg.show_fields ?? ['guest_name', 'category', 'table', 'qr_code', 'event_name'],
    )

    const pdfDoc = await PDFDocument.create()

    // Font
    const fontName =
      cfg.font_family === 'Times-Roman' ? StandardFonts.TimesRoman
      : cfg.font_family === 'Courier' ? StandardFonts.Courier
      : StandardFonts.Helvetica

    const fontBold =
      cfg.font_family === 'Times-Roman' ? StandardFonts.TimesRomanBold
      : cfg.font_family === 'Courier' ? StandardFonts.CourierBold
      : StandardFonts.HelveticaBold

    const font     = await pdfDoc.embedFont(fontName)
    const boldFont = await pdfDoc.embedFont(fontBold)

    // Logo (optional)
    let logoImg: any = null
    if (show.has('logo') && cfg.logo_url) {
      try {
        const resp = await fetch(cfg.logo_url)
        const buf  = await resp.arrayBuffer()
        const ct   = resp.headers.get('content-type') ?? ''
        logoImg = ct.includes('png')
          ? await pdfDoc.embedPng(buf)
          : await pdfDoc.embedJpg(buf)
      } catch { /* silently skip logo if fetch fails */ }
    }

    // Paginate guests into badge cells
    const perPage = layout.cols * layout.rows
    const pages   = Math.ceil(guests.length / perPage)

    // Calculate grid origin to center on page
    const totalGridW = layout.cols * layout.badgeW + (layout.cols - 1) * layout.padX
    const totalGridH = layout.rows * layout.badgeH + (layout.rows - 1) * layout.padY
    const originX = (pageW - totalGridW) / 2
    const originY = (pageH - totalGridH) / 2

    for (let p = 0; p < pages; p++) {
      const page = pdfDoc.addPage([pageW, pageH])
      const slice = guests.slice(p * perPage, (p + 1) * perPage)

      for (let i = 0; i < slice.length; i++) {
        const guest = slice[i]
        const col = i % layout.cols
        const row = Math.floor(i / layout.cols)

        const cellX = originX + col * (layout.badgeW + layout.padX)
        // PDF y is bottom-up; top row is at (pageH - originY - badgeH)
        const cellY = pageH - originY - (row + 1) * layout.badgeH - row * layout.padY

        await this._drawBadge(
          page, font, boldFont,
          guest, event.name,
          cellX, cellY, layout.badgeW, layout.badgeH,
          primary, secondary, textCol,
          show, logoImg,
        )
      }
    }

    return pdfDoc.save()
  }

  // ─── Draw a single badge cell ────────────────────────────────────────────────

  private async _drawBadge(
    page: PDFPage,
    font: PDFFont,
    boldFont: PDFFont,
    guest: GuestRow,
    eventName: string,
    x: number,
    y: number,
    w: number,
    h: number,
    primary: { r: number; g: number; b: number },
    secondary: { r: number; g: number; b: number },
    textCol: { r: number; g: number; b: number },
    show: Set<string>,
    logoImg: any,
  ) {
    const margin = 10
    const innerW = w - margin * 2

    // ── Background rect ──
    page.drawRectangle({
      x, y, width: w, height: h,
      color: rgb(secondary.r, secondary.g, secondary.b),
      borderColor: rgb(primary.r, primary.g, primary.b),
      borderWidth: 1.5,
      borderLineCap: 0 as any,
    })

    // ── Primary colour header bar ──
    const headerH = h * 0.2
    page.drawRectangle({
      x, y: y + h - headerH, width: w, height: headerH,
      color: rgb(primary.r, primary.g, primary.b),
    })

    // ── Event name in header ──
    if (show.has('event_name')) {
      const evName = eventName.length > 28 ? eventName.slice(0, 25) + '…' : eventName
      const evFs = Math.min(10, (w - 20) / (evName.length * 0.55))
      page.drawText(evName, {
        x: x + margin,
        y: y + h - headerH + (headerH - evFs) / 2,
        size: evFs,
        font: boldFont,
        color: rgb(1, 1, 1),
        maxWidth: innerW,
      })
    }

    // ── QR code ──
    let qrX = x + margin
    let qrSize = 0
    if (show.has('qr_code') && guest.qr_code) {
      try {
        const qrBuf = await QRCode.toBuffer(guest.qr_code, {
          errorCorrectionLevel: 'M',
          type: 'png',
          width: 80,
          margin: 1,
        })
        const qrEmbed = await (page as any).doc.embedPng(qrBuf)
        qrSize = Math.min(h * 0.45, w * 0.3)
        qrX = x + w - margin - qrSize
        const qrY = y + (h - headerH - qrSize) / 2 + (h - headerH) * 0.05
        page.drawImage(qrEmbed, { x: qrX, y: qrY, width: qrSize, height: qrSize })
      } catch { /* skip QR if generation fails */ }
    }

    // ── Logo ──
    if (show.has('logo') && logoImg) {
      const logoH = headerH * 0.7
      const logoW = logoH * (logoImg.width / logoImg.height)
      page.drawImage(logoImg, {
        x: x + w - margin - logoW,
        y: y + h - headerH + (headerH - logoH) / 2,
        width: logoW,
        height: logoH,
      })
    }

    // ── Text content area ──
    const textAreaW = qrSize > 0 ? w - margin * 3 - qrSize : innerW
    let curY = y + h - headerH - margin * 1.5

    // Guest name
    if (show.has('guest_name') && guest.full_name) {
      const nameStr = guest.full_name
      const nameFs = Math.min(16, textAreaW / (nameStr.length * 0.6 + 1))
      page.drawText(nameStr, {
        x: x + margin,
        y: curY - nameFs,
        size: nameFs,
        font: boldFont,
        color: rgb(textCol.r, textCol.g, textCol.b),
        maxWidth: textAreaW,
      })
      curY -= nameFs + 6
    }

    // Category badge
    if (show.has('category') && guest.guest_categories?.name) {
      const catName = guest.guest_categories.name
      const catColor = guest.guest_categories.color
        ? hexToRgb(guest.guest_categories.color)
        : primary
      const catFs = 8
      const catPad = 4
      const catW = catName.length * catFs * 0.55 + catPad * 2
      page.drawRectangle({
        x: x + margin,
        y: curY - catFs - catPad * 2,
        width: catW,
        height: catFs + catPad * 2,
        color: rgb(catColor.r, catColor.g, catColor.b),
        opacity: 0.15,
        borderColor: rgb(catColor.r, catColor.g, catColor.b),
        borderWidth: 0.5,
      })
      page.drawText(catName, {
        x: x + margin + catPad,
        y: curY - catFs - catPad,
        size: catFs,
        font: boldFont,
        color: rgb(catColor.r, catColor.g, catColor.b),
        maxWidth: textAreaW,
      })
      curY -= catFs + catPad * 2 + 5
    }

    // Company / designation
    if (show.has('company') && (guest.company || guest.designation)) {
      const compStr = [guest.designation, guest.company].filter(Boolean).join(' · ')
      const compFs = 8
      page.drawText(compStr, {
        x: x + margin,
        y: curY - compFs,
        size: compFs,
        font,
        color: rgb(textCol.r * 0.6, textCol.g * 0.6, textCol.b * 0.6),
        maxWidth: textAreaW,
      })
      curY -= compFs + 5
    }

    // Table number
    if (show.has('table') && guest.table_no) {
      const tableStr = `Table ${guest.table_no}`
      const tableFs = 9
      page.drawText(tableStr, {
        x: x + margin,
        y: curY - tableFs,
        size: tableFs,
        font: boldFont,
        color: rgb(primary.r, primary.g, primary.b),
        maxWidth: textAreaW,
      })
    }

    // ── Dashed cut-line border (subtle, outside the card) ──
    page.drawRectangle({
      x: x - 1, y: y - 1, width: w + 2, height: h + 2,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.3,
      borderDashArray: [3, 3],
      borderDashPhase: 0,
      opacity: 0,
    })
  }
}
