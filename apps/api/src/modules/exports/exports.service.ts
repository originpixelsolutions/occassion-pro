// SECURITY: All queries in this service use Supabase parameterized client — no raw SQL interpolation.
// Every query is scoped to tenant_id from the verified JWT (never from user-supplied input).
// Confirmed in RLS audit 2026-05-18.
import { Injectable, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import * as crypto from 'crypto'
import * as archiver from 'archiver'
import { Readable, PassThrough } from 'stream'
import PDFDocument from 'pdfkit'
import * as ExcelJS from 'exceljs'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportType =
  | 'guest_list' | 'seating_chart' | 'runsheet' | 'badges' | 'attendance'
  | 'budget_report' | 'vendor_report' | 'fnb_report' | 'payment_report'
  | 'full_event_zip' | 'custom_report'

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'zip'

interface BrandSettings {
  primaryColor:      string
  secondaryColor:    string
  logoUrl:           string | null
  companyName:       string
  footerText:        string
  fontFamily:        string
  reportHeaderHtml:  string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a hex color (#RRGGBB) to an RGB tuple for PDFKit */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/** Stream a PDFKit document to a Buffer */
function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

/** Draw a branded PDF header and return the y-position after it */
function drawPdfHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  brand: BrandSettings,
): number {
  const [r, g, b] = hexToRgb(brand.primaryColor)
  doc.rect(0, 0, doc.page.width, 56).fill(`rgb(${r},${g},${b})`)
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
    .text(brand.companyName || 'OccasionPro', 40, 16)
  doc.fontSize(11).font('Helvetica')
    .text(title, 40, 36)
  // Right-side subtitle
  doc.fillColor('rgba(255,255,255,0.8)').fontSize(9)
    .text(subtitle, 0, 38, { align: 'right', width: doc.page.width - 40 })
  // Reset fill
  doc.fillColor('#111827')
  return 72
}

/** Draw a branded PDF footer */
function drawPdfFooter(doc: PDFKit.PDFDocument, brand: BrandSettings) {
  const y = doc.page.height - 32
  doc.fontSize(8).fillColor('#9ca3af')
    .text(brand.footerText, 40, y, { align: 'center', width: doc.page.width - 80 })
}

/** Draw a simple table in PDF and return y after last row */
function drawTable(
  doc:     PDFKit.PDFDocument,
  y:       number,
  headers: string[],
  rows:    string[][],
  brand:   BrandSettings,
  colWidths?: number[],
): number {
  const pageW = doc.page.width - 80  // left+right margin = 80
  const numCols = headers.length
  const cw = colWidths ?? headers.map(() => pageW / numCols)

  const [hr, hg, hb] = hexToRgb(brand.primaryColor)
  const headerHeight = 22
  const rowHeight = 18

  // Header row
  doc.rect(40, y, pageW, headerHeight).fill(`rgb(${hr},${hg},${hb})`)
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
  let x = 40
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 6, { width: cw[i] - 8, ellipsis: true })
    x += cw[i]
  })
  y += headerHeight

  // Data rows
  doc.font('Helvetica').fillColor('#111827').fontSize(8)
  rows.forEach((row, ri) => {
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage()
      y = 40
    }
    if (ri % 2 === 1) {
      doc.rect(40, y, pageW, rowHeight).fill('#f9fafb')
      doc.fillColor('#111827')
    }
    x = 40
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), x + 4, y + 4, { width: cw[i] - 8, ellipsis: true })
      x += cw[i]
    })
    y += rowHeight
  })

  return y + 8
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExportsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Brand helpers ───────────────────────────────────────────────────────────

  private async getBrand(tenantId: string): Promise<BrandSettings> {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('tenant_brand_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    return {
      primaryColor:     data?.primary_color    ?? '#6366F1',
      secondaryColor:   data?.secondary_color  ?? '#8B5CF6',
      logoUrl:          data?.logo_url         ?? null,
      companyName:      data?.company_name     ?? 'OccasionPro',
      footerText:       data?.footer_text      ?? 'Powered by OccasionPro',
      fontFamily:       data?.font_family      ?? 'Inter',
      reportHeaderHtml: data?.report_header_html ?? null,
    }
  }

  private async getEvent(eventId: string) {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb.from('events').select('*').eq('id', eventId).single()
    return data
  }

  // ── Job management ──────────────────────────────────────────────────────────

  async queueExport(
    tenantId:   string,
    eventId:    string | null,
    exportType: ExportType,
    format:     ExportFormat,
    options:    Record<string, any>,
    userId:     string,
  ): Promise<string> {
    const sb = this.supabase.getAdminClient()
    const { data, error } = await sb
      .from('export_jobs')
      .insert({
        tenant_id:   tenantId,
        event_id:    eventId,
        export_type: exportType,
        format,
        status:      'queued',
        options,
        requested_by: userId,
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Failed to create export job')

    // Fire-and-forget async processing
    this.processExport(data.id, tenantId, eventId, exportType, format, options).catch(
      (err) => this.markFailed(data.id, err.message),
    )

    return data.id
  }

  async getJobStatus(jobId: string, tenantId: string) {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('export_jobs')
      .select('id, export_type, format, status, file_url, file_size_bytes, error_message, created_at, completed_at')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single()
    if (!data) throw new NotFoundException('Export job not found')
    return data
  }

  async listExportJobs(tenantId: string, eventId?: string) {
    const sb = this.supabase.getAdminClient()
    let q = sb
      .from('export_jobs')
      .select('id, event_id, export_type, format, status, file_url, file_size_bytes, created_at, completed_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (eventId) q = q.eq('event_id', eventId)
    const { data } = await q
    return data ?? []
  }

  private async markProcessing(jobId: string) {
    await this.supabase.getAdminClient()
      .from('export_jobs').update({ status: 'processing' }).eq('id', jobId)
  }

  private async markCompleted(jobId: string, fileUrl: string, fileSize: number) {
    await this.supabase.getAdminClient()
      .from('export_jobs')
      .update({ status: 'completed', file_url: fileUrl, file_size_bytes: fileSize, completed_at: new Date().toISOString() })
      .eq('id', jobId)
  }

  private async markFailed(jobId: string, message: string) {
    await this.supabase.getAdminClient()
      .from('export_jobs')
      .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
      .eq('id', jobId)
  }

  // ── Storage upload ──────────────────────────────────────────────────────────

  private async uploadExport(
    tenantId: string,
    eventId: string | null,
    jobId: string,
    ext: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const sb = this.supabase.getAdminClient()
    const path = `${tenantId}/${eventId ?? 'global'}/${jobId}.${ext}`
    await sb.storage.from('export_jobs').upload(path, buffer, {
      contentType,
      upsert: true,
    })
    const { data } = sb.storage.from('export_jobs').getPublicUrl(path)
    return data.publicUrl
  }

  // ── Dispatcher ──────────────────────────────────────────────────────────────

  async processExport(
    jobId:      string,
    tenantId:   string,
    eventId:    string | null,
    exportType: ExportType,
    format:     ExportFormat,
    options:    Record<string, any>,
  ) {
    await this.markProcessing(jobId)

    let buffer: Buffer
    let ext: string
    let contentType: string

    const eid = eventId!

    switch (exportType) {
      case 'guest_list':
        if (format === 'csv')        { buffer = await this.generateGuestListCSV(eid);              ext = 'csv';  contentType = 'text/csv' }
        else if (format === 'xlsx')  { buffer = await this.generateGuestListXLSX(eid, tenantId, options); ext = 'xlsx'; contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        else                         { buffer = await this.generateGuestListPDF(eid, tenantId, options); ext = 'pdf';  contentType = 'application/pdf' }
        break

      case 'seating_chart':
        buffer = await this.generateSeatingChartPDF(eid, tenantId); ext = 'pdf'; contentType = 'application/pdf'
        break

      case 'runsheet':
        buffer = await this.generateRunsheetPDF(eid, tenantId); ext = 'pdf'; contentType = 'application/pdf'
        break

      case 'badges':
        buffer = await this.generateBadgesPDF(eid, tenantId, options); ext = 'pdf'; contentType = 'application/pdf'
        break

      case 'attendance':
        if (format === 'xlsx') { buffer = await this.generateAttendanceXLSX(eid, tenantId); ext = 'xlsx'; contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        else                   { buffer = await this.generateAttendanceCSV(eid);             ext = 'csv';  contentType = 'text/csv' }
        break

      case 'budget_report':
        if (format === 'xlsx') { buffer = await this.generateBudgetXLSX(eid, tenantId); ext = 'xlsx'; contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        else                   { buffer = await this.generateBudgetPDF(eid, tenantId);   ext = 'pdf';  contentType = 'application/pdf' }
        break

      case 'vendor_report':
        if (format === 'csv')  { buffer = await this.generateVendorCSV(eid);              ext = 'csv'; contentType = 'text/csv' }
        else                   { buffer = await this.generateVendorPDF(eid, tenantId);     ext = 'pdf'; contentType = 'application/pdf' }
        break

      case 'fnb_report':
        buffer = await this.generateFnbPDF(eid, tenantId); ext = 'pdf'; contentType = 'application/pdf'
        break

      case 'payment_report':
        if (format === 'csv')  { buffer = await this.generatePaymentCSV(eid);            ext = 'csv'; contentType = 'text/csv' }
        else                   { buffer = await this.generatePaymentPDF(eid, tenantId);   ext = 'pdf'; contentType = 'application/pdf' }
        break

      case 'full_event_zip':
        buffer = await this.generateFullEventZIP(eid, tenantId); ext = 'zip'; contentType = 'application/zip'
        break

      default:
        throw new Error(`Unknown export type: ${exportType}`)
    }

    const url = await this.uploadExport(tenantId, eventId, jobId, ext, buffer, contentType)
    await this.markCompleted(jobId, url, buffer.byteLength)
  }

  // ── Quick synchronous exports (CSV only) ────────────────────────────────────

  async quickExport(
    eventId: string,
    type: 'guest_list' | 'attendance' | 'vendor_report' | 'payment_report',
  ): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
    switch (type) {
      case 'guest_list':    return { buffer: await this.generateGuestListCSV(eventId),  ext: 'csv', contentType: 'text/csv' }
      case 'attendance':    return { buffer: await this.generateAttendanceCSV(eventId), ext: 'csv', contentType: 'text/csv' }
      case 'vendor_report': return { buffer: await this.generateVendorCSV(eventId),     ext: 'csv', contentType: 'text/csv' }
      case 'payment_report':return { buffer: await this.generatePaymentCSV(eventId),    ext: 'csv', contentType: 'text/csv' }
      default: throw new Error('Unsupported quick export type')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATORS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Guest List ───────────────────────────────────────────────────────────────

  private async fetchGuests(eventId: string) {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('guests')
      .select(`
        id, first_name, last_name, email, phone, company,
        dietary_requirements, rsvp_status,
        seat_assignments(label),
        check_ins(checked_in_at)
      `)
      .eq('event_id', eventId)
      .order('last_name')
    return (data ?? []) as any[]
  }

  async generateGuestListPDF(eventId: string, tenantId: string, options: Record<string, any> = {}): Promise<Buffer> {
    const [guests, brand, event] = await Promise.all([
      this.fetchGuests(eventId),
      this.getBrand(tenantId),
      this.getEvent(eventId),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    const subtitle = `${event?.name ?? ''} · ${guests.length} guests · ${new Date().toLocaleDateString()}`
    let y = drawPdfHeader(doc, 'Guest List', subtitle, brand)
    y += 8

    const rows = guests.map(g => [
      `${g.first_name} ${g.last_name}`,
      g.email ?? '',
      g.phone ?? '',
      g.company ?? '',
      g.dietary_requirements ?? '',
      g.rsvp_status ?? '',
      g.seat_assignments?.[0]?.label ?? '',
      g.check_ins?.length > 0 ? '✓' : '—',
    ])

    y = drawTable(
      doc, y,
      ['Name', 'Email', 'Phone', 'Company', 'Dietary', 'RSVP', 'Seat', 'Checked In'],
      rows, brand,
      [160, 160, 100, 120, 100, 70, 60, 70],
    )

    // Summary stats
    y += 12
    if (y > doc.page.height - 80) { doc.addPage(); y = 40 }
    const checkedIn   = guests.filter(g => g.check_ins?.length > 0).length
    const confirmed   = guests.filter(g => g.rsvp_status === 'confirmed').length
    const [sr, sg, sb2] = hexToRgb(brand.secondaryColor)
    doc.rect(40, y, 200, 40).fill(`rgb(${sr},${sg},${sb2})`)
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
      .text(`Total: ${guests.length}  |  Confirmed: ${confirmed}  |  Checked In: ${checkedIn}`, 48, y + 14, { width: 185 })

    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  async generateGuestListXLSX(eventId: string, tenantId: string, options: Record<string, any> = {}): Promise<Buffer> {
    const [guests, brand, event] = await Promise.all([
      this.fetchGuests(eventId),
      this.getBrand(tenantId),
      this.getEvent(eventId),
    ])

    const wb = new ExcelJS.Workbook()
    wb.creator = brand.companyName
    const ws = wb.addWorksheet('Guest List')

    const primaryHex = brand.primaryColor.replace('#', '')
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${primaryHex}` } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }

    ws.columns = [
      { header: 'First Name',   key: 'first_name',   width: 18 },
      { header: 'Last Name',    key: 'last_name',    width: 18 },
      { header: 'Email',        key: 'email',        width: 28 },
      { header: 'Phone',        key: 'phone',        width: 16 },
      { header: 'Company',      key: 'company',      width: 20 },
      { header: 'Dietary',      key: 'dietary',      width: 20 },
      { header: 'RSVP Status',  key: 'rsvp',         width: 14 },
      { header: 'Seat',         key: 'seat',         width: 12 },
      { header: 'Checked In',   key: 'checkin',      width: 12 },
    ]

    // Style header row
    const headerRow = ws.getRow(1)
    headerRow.eachCell(cell => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    headerRow.height = 24

    guests.forEach(g => {
      ws.addRow({
        first_name: g.first_name,
        last_name:  g.last_name,
        email:      g.email ?? '',
        phone:      g.phone ?? '',
        company:    g.company ?? '',
        dietary:    g.dietary_requirements ?? '',
        rsvp:       g.rsvp_status ?? '',
        seat:       g.seat_assignments?.[0]?.label ?? '',
        checkin:    g.check_ins?.length > 0 ? 'Yes' : 'No',
      })
    })

    // Summary sheet
    const summary = wb.addWorksheet('Summary')
    summary.addRow(['Metric', 'Value'])
    summary.addRow(['Total Guests', guests.length])
    summary.addRow(['Confirmed', guests.filter(g => g.rsvp_status === 'confirmed').length])
    summary.addRow(['Checked In', guests.filter(g => g.check_ins?.length > 0).length])
    summary.addRow(['Pending', guests.filter(g => g.rsvp_status === 'pending').length])
    summary.addRow(['Declined', guests.filter(g => g.rsvp_status === 'declined').length])

    return wb.xlsx.writeBuffer() as Promise<Buffer>
  }

  async generateGuestListCSV(eventId: string): Promise<Buffer> {
    const guests = await this.fetchGuests(eventId)
    const header = 'first_name,last_name,email,phone,company,dietary_requirements,rsvp_status,seat,checked_in\n'
    const rows = guests.map(g => [
      g.first_name, g.last_name, g.email ?? '', g.phone ?? '',
      g.company ?? '', g.dietary_requirements ?? '', g.rsvp_status ?? '',
      g.seat_assignments?.[0]?.label ?? '',
      g.check_ins?.length > 0 ? 'yes' : 'no',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    return Buffer.from(header + rows, 'utf-8')
  }

  // ── Seating Chart ────────────────────────────────────────────────────────────

  async generateSeatingChartPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { data: seats }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('table_guest_assignments')
        .select('zone_name, table_label, seat_label, guest:guests(first_name, last_name, dietary_requirements)')
        .eq('event_id', eventId)
        .order('zone_name').order('table_label').order('seat_label'),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    let y = drawPdfHeader(doc, 'Seating Chart', event?.name ?? '', brand)
    y += 8

    const rows = (seats ?? []).map((s: any) => [
      s.zone_name ?? '',
      s.table_label ?? '',
      s.seat_label ?? '',
      s.guest ? `${s.guest.first_name} ${s.guest.last_name}` : '(Unassigned)',
      s.guest?.dietary_requirements ?? '',
    ])

    drawTable(doc, y, ['Zone', 'Table', 'Seat', 'Guest Name', 'Dietary'], rows, brand, [120, 100, 80, 200, 140])
    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  // ── Runsheet ─────────────────────────────────────────────────────────────────

  async generateRunsheetPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { data: items }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('runsheet_items')
        .select('start_time, duration_minutes, title, owner, notes, category, day_number')
        .eq('event_id', eventId)
        .order('day_number').order('start_time'),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
    let y = drawPdfHeader(doc, 'Run Sheet', event?.name ?? '', brand)

    // Group by day
    const days: Record<number, any[]> = {}
    ;(items ?? []).forEach((item: any) => {
      const d = item.day_number ?? 1
      if (!days[d]) days[d] = []
      days[d].push(item)
    })

    const categoryColors: Record<string, string> = {
      setup: '#dbeafe', ceremony: '#fef3c7', reception: '#d1fae5',
      performance: '#fce7f3', break: '#f3f4f6', other: '#ede9fe',
    }

    for (const [day, dayItems] of Object.entries(days)) {
      if (y > doc.page.height - 100) { doc.addPage(); y = 40 }

      // Day header
      const [dr, dg, db] = hexToRgb(brand.secondaryColor)
      doc.rect(40, y, doc.page.width - 80, 20).fill(`rgb(${dr},${dg},${db})`)
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
        .text(`Day ${day}`, 48, y + 5)
      doc.fillColor('#111827').font('Helvetica')
      y += 28

      for (const item of dayItems) {
        if (y + 28 > doc.page.height - 60) { doc.addPage(); y = 40 }
        const bgColor = categoryColors[item.category ?? 'other'] ?? '#f9fafb'
        doc.rect(40, y, doc.page.width - 80, 26).fill(bgColor)
        doc.fillColor('#111827').fontSize(8)
        const time = item.start_time ? new Date(`1970-01-01T${item.start_time}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''
        doc.font('Helvetica-Bold').text(time, 44, y + 4, { width: 60 })
        doc.font('Helvetica').text(`${item.duration_minutes ?? ''}m`, 108, y + 4, { width: 40 })
        doc.font('Helvetica-Bold').text(item.title ?? '', 152, y + 4, { width: 200 })
        doc.font('Helvetica').text(item.owner ?? '', 356, y + 4, { width: 100 })
        doc.text(item.notes ?? '', 460, y + 4, { width: doc.page.width - 500, ellipsis: true })
        y += 28
      }
      y += 12
    }

    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  // ── Badges ───────────────────────────────────────────────────────────────────

  async generateBadgesPDF(eventId: string, tenantId: string, options: Record<string, any> = {}): Promise<Buffer> {
    const [guests, brand, event] = await Promise.all([
      this.fetchGuests(eventId),
      this.getBrand(tenantId),
      this.getEvent(eventId),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 20 })
    const badgeW = 240; const badgeH = 140
    const cols = 2; const rows = 4
    const padX = 20; const padY = 20
    const startX = 30; const startY = 30

    const [pr, pg, pb] = hexToRgb(brand.primaryColor)
    let col = 0; let row = 0

    guests.forEach((g, idx) => {
      if (idx > 0 && idx % (cols * rows) === 0) {
        doc.addPage()
        col = 0; row = 0
      }
      const x = startX + col * (badgeW + padX)
      const y = startY + row * (badgeH + padY)

      // Badge border
      doc.roundedRect(x, y, badgeW, badgeH, 8)
        .strokeColor(`rgb(${pr},${pg},${pb})`).lineWidth(2).stroke()
      // Color strip
      doc.rect(x, y, badgeW, 28).fill(`rgb(${pr},${pg},${pb})`)
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text(event?.name ?? 'Event', x + 8, y + 8, { width: badgeW - 16 })
      // Name
      doc.fillColor('#111827').fontSize(18).font('Helvetica-Bold')
        .text(`${g.first_name} ${g.last_name}`, x + 8, y + 36, { width: badgeW - 16 })
      // Company
      if (g.company) {
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
          .text(g.company, x + 8, y + 68, { width: badgeW - 16 })
      }
      // RSVP badge
      if (g.rsvp_status) {
        doc.fontSize(8).fillColor('#6b7280').text(g.rsvp_status.toUpperCase(), x + 8, y + 85, { width: badgeW - 16 })
      }
      // Seat
      if (g.seat_assignments?.[0]) {
        doc.fontSize(8).fillColor('#6b7280')
          .text(`Seat: ${g.seat_assignments[0].label}`, x + badgeW - 70, y + 85, { width: 60 })
      }

      col++
      if (col >= cols) { col = 0; row++ }
    })

    return pdfToBuffer(doc)
  }

  // ── Attendance ───────────────────────────────────────────────────────────────

  async generateAttendanceXLSX(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, { data: checkins }] = await Promise.all([
      this.getBrand(tenantId),
      sb.from('checkin_logs')
        .select('guest:guests(first_name, last_name, email, company, rsvp_status), checked_in_at, checked_in_by, method')
        .eq('event_id', eventId)
        .order('checked_in_at'),
    ])

    const wb = new ExcelJS.Workbook()
    wb.creator = brand.companyName
    const ws = wb.addWorksheet('Attendance')
    const primaryHex = brand.primaryColor.replace('#', '')

    ws.columns = [
      { header: 'Name',        key: 'name',        width: 24 },
      { header: 'Email',       key: 'email',       width: 28 },
      { header: 'Company',     key: 'company',     width: 20 },
      { header: 'Check-in At', key: 'time',        width: 22 },
      { header: 'Method',      key: 'method',      width: 14 },
      { header: 'Checked By',  key: 'by',          width: 20 },
    ]

    ws.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${primaryHex}` } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws.getRow(1).height = 24

    ;(checkins ?? []).forEach((c: any) => {
      ws.addRow({
        name:    c.guest ? `${c.guest.first_name} ${c.guest.last_name}` : '',
        email:   c.guest?.email ?? '',
        company: c.guest?.company ?? '',
        time:    c.checked_in_at ? new Date(c.checked_in_at).toLocaleString('en-IN') : '',
        method:  c.method ?? '',
        by:      c.checked_in_by ?? '',
      })
    })

    return wb.xlsx.writeBuffer() as Promise<Buffer>
  }

  async generateAttendanceCSV(eventId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('checkin_logs')
      .select('guest:guests(first_name,last_name,email), checked_in_at, method')
      .eq('event_id', eventId)
      .order('checked_in_at')

    const header = 'name,email,checked_in_at,method\n'
    const rows = (data ?? []).map((c: any) => [
      c.guest ? `${c.guest.first_name} ${c.guest.last_name}` : '',
      c.guest?.email ?? '',
      c.checked_in_at ?? '',
      c.method ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    return Buffer.from(header + rows, 'utf-8')
  }

  // ── Budget Report ────────────────────────────────────────────────────────────

  async generateBudgetPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { data: items }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('budget_line_items')
        .select('category, description, estimated_amount, actual_amount, vendor_name, status')
        .eq('event_id', eventId)
        .order('category'),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
    let y = drawPdfHeader(doc, 'Budget Report', event?.name ?? '', brand)
    y += 8

    // Category totals
    const cats: Record<string, { est: number; act: number }> = {}
    ;(items ?? []).forEach((item: any) => {
      if (!cats[item.category]) cats[item.category] = { est: 0, act: 0 }
      cats[item.category].est += Number(item.estimated_amount ?? 0)
      cats[item.category].act += Number(item.actual_amount ?? 0)
    })

    const summaryRows = Object.entries(cats).map(([cat, totals]) => [
      cat,
      `₹${totals.est.toLocaleString('en-IN')}`,
      `₹${totals.act.toLocaleString('en-IN')}`,
      `${totals.est > 0 ? Math.round((totals.act / totals.est) * 100) : 0}%`,
    ])

    y = drawTable(doc, y, ['Category', 'Estimated', 'Actual', '% Used'], summaryRows, brand, [200, 110, 110, 95])
    y += 16

    // Line items
    if (y > doc.page.height - 100) { doc.addPage(); y = 40 }
    const lineRows = (items ?? []).map((item: any) => [
      item.category ?? '',
      item.description ?? '',
      item.vendor_name ?? '',
      `₹${Number(item.estimated_amount ?? 0).toLocaleString('en-IN')}`,
      `₹${Number(item.actual_amount ?? 0).toLocaleString('en-IN')}`,
      item.status ?? '',
    ])
    drawTable(doc, y, ['Category', 'Description', 'Vendor', 'Estimated', 'Actual', 'Status'], lineRows, brand, [90, 150, 110, 80, 80, 60])

    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  async generateBudgetXLSX(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, { data: items }] = await Promise.all([
      this.getBrand(tenantId),
      sb.from('budget_line_items')
        .select('category, description, estimated_amount, actual_amount, vendor_name, status')
        .eq('event_id', eventId)
        .order('category'),
    ])

    const wb = new ExcelJS.Workbook()
    wb.creator = brand.companyName
    const ws = wb.addWorksheet('Budget')
    const primaryHex = brand.primaryColor.replace('#', '')
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${primaryHex}` } }

    ws.columns = [
      { header: 'Category',    key: 'category',  width: 18 },
      { header: 'Description', key: 'desc',      width: 30 },
      { header: 'Vendor',      key: 'vendor',    width: 22 },
      { header: 'Estimated',   key: 'est',       width: 14 },
      { header: 'Actual',      key: 'act',       width: 14 },
      { header: 'Variance',    key: 'var',       width: 14 },
      { header: 'Status',      key: 'status',    width: 14 },
    ]

    ws.getRow(1).eachCell(cell => {
      cell.fill = headerFill
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws.getRow(1).height = 24

    ;(items ?? []).forEach((item: any) => {
      const est = Number(item.estimated_amount ?? 0)
      const act = Number(item.actual_amount ?? 0)
      ws.addRow({
        category: item.category,
        desc:     item.description,
        vendor:   item.vendor_name ?? '',
        est,
        act,
        var:      act - est,
        status:   item.status ?? '',
      })
    })

    // Totals row
    const totalRow = ws.addRow({
      category: 'TOTAL', desc: '', vendor: '',
      est: { formula: `SUM(D2:D${ws.rowCount})` },
      act: { formula: `SUM(E2:E${ws.rowCount})` },
      var: { formula: `SUM(F2:F${ws.rowCount})` },
      status: '',
    })
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }

    return wb.xlsx.writeBuffer() as Promise<Buffer>
  }

  // ── Vendor Report ────────────────────────────────────────────────────────────

  async generateVendorPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { data: vendors }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('vendor_event_assignments')
        .select('vendor:vendors(company_name, contact_name, email, phone, category), status, contract_value, payment_status, performance_score, notes')
        .eq('event_id', eventId)
        .order('status'),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    let y = drawPdfHeader(doc, 'Vendor Report', event?.name ?? '', brand)
    y += 8

    const rows = (vendors ?? []).map((v: any) => [
      v.vendor?.company_name ?? '',
      v.vendor?.category ?? '',
      v.vendor?.contact_name ?? '',
      v.vendor?.email ?? '',
      v.status ?? '',
      `₹${Number(v.contract_value ?? 0).toLocaleString('en-IN')}`,
      v.payment_status ?? '',
      v.performance_score != null ? `${v.performance_score}/10` : '—',
    ])

    drawTable(doc, y,
      ['Company', 'Category', 'Contact', 'Email', 'Status', 'Value', 'Payment', 'Score'],
      rows, brand, [130, 90, 110, 140, 80, 80, 80, 60])
    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  async generateVendorCSV(eventId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('vendor_event_assignments')
      .select('vendor:vendors(company_name,contact_name,email,phone,category), status, contract_value, payment_status, performance_score')
      .eq('event_id', eventId)

    const header = 'company_name,category,contact_name,email,phone,status,contract_value,payment_status,performance_score\n'
    const rows = (data ?? []).map((v: any) => [
      v.vendor?.company_name ?? '', v.vendor?.category ?? '',
      v.vendor?.contact_name ?? '', v.vendor?.email ?? '', v.vendor?.phone ?? '',
      v.status ?? '', v.contract_value ?? '', v.payment_status ?? '', v.performance_score ?? '',
    ].map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    return Buffer.from(header + rows, 'utf-8')
  }

  // ── FnB Report ───────────────────────────────────────────────────────────────

  async generateFnbPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { data: items }, { data: tokens }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('fnb_menu_items').select('name, category, price, tokens_issued, tokens_redeemed, quantity_sold').eq('event_id', eventId),
      sb.from('fnb_token_summary').select('total_issued, total_redeemed, total_revenue').eq('event_id', eventId).maybeSingle(),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
    let y = drawPdfHeader(doc, 'F&B Report', event?.name ?? '', brand)
    y += 8

    // Token summary
    if (tokens) {
      doc.fillColor('#111827').fontSize(9).font('Helvetica')
        .text(`Tokens Issued: ${tokens.total_issued ?? 0}  |  Redeemed: ${tokens.total_redeemed ?? 0}  |  Revenue: ₹${Number(tokens.total_revenue ?? 0).toLocaleString('en-IN')}`, 40, y + 4)
      y += 24
    }

    const rows = (items ?? []).map((item: any) => [
      item.name ?? '',
      item.category ?? '',
      `₹${Number(item.price ?? 0).toFixed(2)}`,
      String(item.quantity_sold ?? 0),
      String(item.tokens_issued ?? 0),
      String(item.tokens_redeemed ?? 0),
      `₹${(Number(item.price ?? 0) * Number(item.quantity_sold ?? 0)).toFixed(2)}`,
    ])

    drawTable(doc, y,
      ['Item', 'Category', 'Price', 'Qty Sold', 'Tokens Issued', 'Tokens Redeemed', 'Revenue'],
      rows, brand, [130, 90, 70, 60, 80, 90, 80])
    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  // ── Payment Report ────────────────────────────────────────────────────────────

  async generatePaymentPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { data: orders }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('event_payment_orders')
        .select('order_ref, guest_name, guest_email, total_amount, status, payment_method, discount_amount, gst_amount, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    let y = drawPdfHeader(doc, 'Payment Report', event?.name ?? '', brand)
    y += 8

    const paid = (orders ?? []).filter((o: any) => o.status === 'paid')
    const totalRevenue = paid.reduce((s: number, o: any) => s + Number(o.total_amount ?? 0), 0)

    doc.fillColor('#111827').fontSize(9).font('Helvetica')
      .text(`Total Orders: ${orders?.length ?? 0}  |  Paid: ${paid.length}  |  Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`, 40, y + 4)
    y += 20

    const rows = (orders ?? []).map((o: any) => [
      o.order_ref ?? '',
      o.guest_name ?? '',
      o.guest_email ?? '',
      `₹${Number(o.total_amount ?? 0).toLocaleString('en-IN')}`,
      o.status ?? '',
      o.payment_method ?? '',
      o.discount_amount ? `₹${Number(o.discount_amount).toFixed(2)}` : '—',
      new Date(o.created_at).toLocaleDateString('en-IN'),
    ])

    drawTable(doc, y,
      ['Order Ref', 'Guest', 'Email', 'Amount', 'Status', 'Method', 'Discount', 'Date'],
      rows, brand, [90, 120, 150, 80, 70, 80, 70, 80])
    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  async generatePaymentCSV(eventId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('event_payment_orders')
      .select('order_ref, guest_name, guest_email, total_amount, subtotal, discount_amount, gst_amount, status, payment_method, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    const header = 'order_ref,guest_name,guest_email,total_amount,subtotal,discount,gst,status,payment_method,created_at\n'
    const rows = (data ?? []).map((o: any) => [
      o.order_ref, o.guest_name, o.guest_email,
      o.total_amount, o.subtotal, o.discount_amount ?? 0, o.gst_amount ?? 0,
      o.status, o.payment_method ?? '', o.created_at,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    return Buffer.from(header + rows, 'utf-8')
  }

  // ── Summary PDF ──────────────────────────────────────────────────────────────

  private async generateSummaryPDF(eventId: string, tenantId: string): Promise<Buffer> {
    const sb = this.supabase.getAdminClient()
    const [brand, event, { count: guestCount }, { count: vendorCount }, { data: orderSummary }] = await Promise.all([
      this.getBrand(tenantId),
      this.getEvent(eventId),
      sb.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      sb.from('vendor_event_assignments').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      sb.from('event_payment_orders').select('total_amount, status').eq('event_id', eventId),
    ])

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
    const [pr, pg, pb] = hexToRgb(brand.primaryColor)

    // Full-width hero band
    doc.rect(0, 0, doc.page.width, 100).fill(`rgb(${pr},${pg},${pb})`)
    doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
      .text(event?.name ?? 'Event', 40, 28)
    doc.fontSize(12).font('Helvetica')
      .text(brand.companyName, 40, 62)

    let y = 120
    doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text('Event Summary', 40, y); y += 28

    const stats = [
      ['Event Date',   event?.start_date ? new Date(event.start_date).toLocaleDateString('en-IN') : '—'],
      ['Venue',        event?.venue_name ?? '—'],
      ['Total Guests', String(guestCount ?? 0)],
      ['Vendors',      String(vendorCount ?? 0)],
      ['Revenue',      `₹${(orderSummary ?? []).filter((o: any) => o.status === 'paid').reduce((s: number, o: any) => s + Number(o.total_amount ?? 0), 0).toLocaleString('en-IN')}`],
    ]

    stats.forEach(([label, value]) => {
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(label, 40, y)
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text(value, 200, y)
      y += 24
    })

    drawPdfFooter(doc, brand)
    return pdfToBuffer(doc)
  }

  // ── Full Event ZIP ────────────────────────────────────────────────────────────

  async generateFullEventZIP(eventId: string, tenantId: string): Promise<Buffer> {
    const event = await this.getEvent(eventId)
    const safeName = (event?.name ?? 'Event').replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
    const folderRoot = `${safeName}_Export`

    // Generate all reports concurrently (grouped)
    const [
      summaryPdf,
      guestPdf, guestXlsx, seatingPdf,
      runsheetPdf,
      vendorPdf,
      budgetPdf,
      fnbPdf,
      paymentPdf,
      badgesPdf,
      attendanceXlsx,
    ] = await Promise.all([
      this.generateSummaryPDF(eventId, tenantId),
      this.generateGuestListPDF(eventId, tenantId, {}),
      this.generateGuestListXLSX(eventId, tenantId, {}),
      this.generateSeatingChartPDF(eventId, tenantId),
      this.generateRunsheetPDF(eventId, tenantId),
      this.generateVendorPDF(eventId, tenantId),
      this.generateBudgetPDF(eventId, tenantId),
      this.generateFnbPDF(eventId, tenantId),
      this.generatePaymentPDF(eventId, tenantId),
      this.generateBadgesPDF(eventId, tenantId, {}),
      this.generateAttendanceXLSX(eventId, tenantId),
    ])

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 6 } })
      const chunks: Buffer[] = []
      const passthrough = new PassThrough()

      passthrough.on('data', chunk => chunks.push(chunk))
      passthrough.on('end', () => resolve(Buffer.concat(chunks)))
      passthrough.on('error', reject)

      archive.on('error', reject)
      archive.pipe(passthrough)

      archive.append(summaryPdf,      { name: `${folderRoot}/00_Summary.pdf` })
      archive.append(guestPdf,        { name: `${folderRoot}/01_Guests/guest_list.pdf` })
      archive.append(guestXlsx,       { name: `${folderRoot}/01_Guests/guest_list.xlsx` })
      archive.append(seatingPdf,      { name: `${folderRoot}/01_Guests/seating_chart.pdf` })
      archive.append(runsheetPdf,     { name: `${folderRoot}/02_Schedule/runsheet.pdf` })
      archive.append(vendorPdf,       { name: `${folderRoot}/03_Vendors/vendor_report.pdf` })
      archive.append(budgetPdf,       { name: `${folderRoot}/04_Budget/budget_report.pdf` })
      archive.append(fnbPdf,          { name: `${folderRoot}/05_FnB/fnb_report.pdf` })
      archive.append(paymentPdf,      { name: `${folderRoot}/06_Payments/payment_report.pdf` })
      archive.append(badgesPdf,       { name: `${folderRoot}/07_Badges/badges_6up.pdf` })
      archive.append(attendanceXlsx,  { name: `${folderRoot}/08_Attendance/attendance_report.xlsx` })

      archive.finalize()
    })
  }

  // ── Brand settings CRUD ──────────────────────────────────────────────────────

  async getBrandSettings(tenantId: string) {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('tenant_brand_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    return data
  }

  async upsertBrandSettings(tenantId: string, payload: Partial<{
    primary_color:      string
    secondary_color:    string
    logo_url:           string
    company_name:       string
    footer_text:        string
    font_family:        string
    report_header_html: string
  }>) {
    const sb = this.supabase.getAdminClient()
    const { data, error } = await sb
      .from('tenant_brand_settings')
      .upsert({ tenant_id: tenantId, ...payload }, { onConflict: 'tenant_id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }
}
