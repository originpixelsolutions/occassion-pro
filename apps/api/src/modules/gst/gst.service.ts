import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface UpsertGstSettingsDto {
  gstin?: string
  legal_name?: string
  trade_name?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  state_code?: string
  pincode?: string
  default_gst_type?: 'regular' | 'composition' | 'exempt' | 'unregistered'
  reverse_charge_applicable?: boolean
  e_invoicing_enabled?: boolean
  auto_calculate_gst?: boolean
  invoice_prefix?: string
  credit_note_prefix?: string
}

export interface CreateTaxRateDto {
  name: string
  description?: string
  hsn_sac_code?: string
  is_service?: boolean
  cgst_rate: number
  sgst_rate: number
  igst_rate?: number
  utgst_rate?: number
  cess_rate?: number
  is_exempt?: boolean
  is_nil_rated?: boolean
  is_reverse_charge?: boolean
  is_default?: boolean
}

export interface CreateTaxInvoiceDto {
  event_id?: string
  invoice_type?: 'tax_invoice' | 'proforma' | 'credit_note' | 'debit_note'
  invoice_date?: string
  due_date?: string
  original_invoice_id?: string
  buyer_name: string
  buyer_gstin?: string
  buyer_address?: string
  buyer_state_code?: string
  buyer_pan?: string
  supply_type?: 'B2B' | 'B2C' | 'SEZ' | 'Export' | 'Import'
  place_of_supply?: string
  reverse_charge?: boolean
  notes?: string
  terms?: string
  currency?: string
  line_items: CreateLineItemDto[]
}

export interface CreateLineItemDto {
  description: string
  item_code?: string
  hsn_sac_code?: string
  is_service?: boolean
  quantity: number
  unit?: string
  unit_price: number
  discount_pct?: number
  tax_rate_id?: string
  cgst_rate?: number
  sgst_rate?: number
  igst_rate?: number
  utgst_rate?: number
  cess_rate?: number
  is_nil_rated?: boolean
  is_exempt?: boolean
  is_reverse_charge?: boolean
}

export interface UpdateTaxInvoiceDto {
  invoice_date?: string
  due_date?: string
  buyer_name?: string
  buyer_gstin?: string
  buyer_address?: string
  buyer_state_code?: string
  supply_type?: string
  place_of_supply?: string
  notes?: string
  terms?: string
  status?: 'draft' | 'finalized' | 'sent' | 'paid' | 'cancelled' | 'void'
}

export interface CreateFilingDto {
  return_type: 'GSTR-1' | 'GSTR-2A' | 'GSTR-3B' | 'GSTR-9' | 'GSTR-9C' | 'IFF' | 'CMP-08'
  tax_period: string
  frequency?: 'monthly' | 'quarterly' | 'annual'
  due_date?: string
  total_outward_supplies?: number
  total_inward_supplies?: number
  total_igst_payable?: number
  total_cgst_payable?: number
  total_sgst_payable?: number
  late_fee?: number
  interest?: number
  notes?: string
}

export interface UpdateFilingDto {
  status?: 'pending' | 'in_progress' | 'filed' | 'nil_filed' | 'under_process' | 'error'
  arn?: string
  filing_date?: string
  total_outward_supplies?: number
  total_inward_supplies?: number
  total_igst_payable?: number
  total_cgst_payable?: number
  total_sgst_payable?: number
  total_cess_payable?: number
  late_fee?: number
  interest?: number
  notes?: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GstService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(tenantId: string, eventId?: string, period?: string) {
    const client = this.supabase.getClient()

    // Build invoice query
    let q = client
      .from('tax_invoices')
      .select('status, payment_status, taxable_amount, cgst_amount, sgst_amount, igst_amount, cess_amount, grand_total, invoice_date')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .neq('status', 'void')

    if (eventId) q = q.eq('event_id', eventId)

    // Period filter: 'MM-YYYY' → date range
    if (period) {
      const [month, year] = period.split('-')
      const from = new Date(Number(year), Number(month) - 1, 1)
      const to   = new Date(Number(year), Number(month), 0) // last day
      q = q.gte('invoice_date', from.toISOString().split('T')[0])
           .lte('invoice_date', to.toISOString().split('T')[0])
    }

    const { data: invoices, error } = await q
    if (error) throw new BadRequestException(error.message)

    const summary = (invoices ?? []).reduce(
      (acc, inv) => {
        acc.taxable_revenue += Number(inv.taxable_amount ?? 0)
        acc.cgst_collected  += Number(inv.cgst_amount    ?? 0)
        acc.sgst_collected  += Number(inv.sgst_amount    ?? 0)
        acc.igst_collected  += Number(inv.igst_amount    ?? 0)
        acc.cess_collected  += Number(inv.cess_amount    ?? 0)
        acc.total_revenue   += Number(inv.grand_total    ?? 0)
        if (inv.payment_status === 'paid') acc.collected += Number(inv.grand_total ?? 0)
        if (inv.payment_status === 'unpaid' || inv.payment_status === 'partial')
          acc.outstanding += Number(inv.grand_total ?? 0) - Number((inv as any).amount_paid ?? 0)
        acc.invoice_count++
        return acc
      },
      { taxable_revenue: 0, cgst_collected: 0, sgst_collected: 0,
        igst_collected: 0, cess_collected: 0, total_revenue: 0,
        collected: 0, outstanding: 0, invoice_count: 0 },
    )

    const total_gst = summary.cgst_collected + summary.sgst_collected + summary.igst_collected + summary.cess_collected

    // Pending filings
    const { data: filings } = await client
      .from('gst_filings')
      .select('return_type, tax_period, status, due_date')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(5)

    // ITC summary
    const { data: itcRows } = await client
      .from('itc_ledger')
      .select('entry_type, igst_credit, cgst_credit, sgst_credit, cess_credit')
      .eq('tenant_id', tenantId)
      .eq('availed', true)

    const itc = (itcRows ?? []).reduce(
      (acc, r) => {
        const sign = r.entry_type === 'debit' || r.entry_type === 'reversal' ? -1 : 1
        acc.igst += sign * Number(r.igst_credit ?? 0)
        acc.cgst += sign * Number(r.cgst_credit ?? 0)
        acc.sgst += sign * Number(r.sgst_credit ?? 0)
        acc.cess += sign * Number(r.cess_credit ?? 0)
        return acc
      },
      { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    )

    const net_gst_payable = total_gst - (itc.igst + itc.cgst + itc.sgst + itc.cess)

    return {
      summary: { ...summary, total_gst, net_gst_payable },
      itc,
      pending_filings: filings ?? [],
    }
  }

  // ── GST Settings ───────────────────────────────────────────────────────────

  async getSettings(tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('gst_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') throw new BadRequestException(error.message)
    return data ?? null
  }

  async upsertSettings(tenantId: string, dto: UpsertGstSettingsDto) {
    // Validate GSTIN format if provided
    if (dto.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(dto.gstin)) {
      throw new BadRequestException('Invalid GSTIN format')
    }

    const { data, error } = await this.supabase.getClient()
      .from('gst_settings')
      .upsert({ ...dto, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Tax Rates ──────────────────────────────────────────────────────────────

  async getTaxRates(tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('tax_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('total_rate', { ascending: true })

    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createTaxRate(tenantId: string, dto: CreateTaxRateDto) {
    // If setting as default, unset existing default first
    if (dto.is_default) {
      await this.supabase.getClient()
        .from('tax_rates')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
    }

    const { data, error } = await this.supabase.getClient()
      .from('tax_rates')
      .insert({ ...dto, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateTaxRate(tenantId: string, rateId: string, dto: Partial<CreateTaxRateDto>) {
    const { data: existing } = await this.supabase.getClient()
      .from('tax_rates')
      .select('id')
      .eq('id', rateId)
      .eq('tenant_id', tenantId)
      .single()

    if (!existing) throw new NotFoundException('Tax rate not found')

    if (dto.is_default) {
      await this.supabase.getClient()
        .from('tax_rates')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .neq('id', rateId)
    }

    const { data, error } = await this.supabase.getClient()
      .from('tax_rates')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', rateId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteTaxRate(tenantId: string, rateId: string) {
    const { error } = await this.supabase.getClient()
      .from('tax_rates')
      .delete()
      .eq('id', rateId)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── Tax Invoices ───────────────────────────────────────────────────────────

  async getInvoices(tenantId: string, eventId?: string, status?: string, page = 1, limit = 20) {
    const from = (page - 1) * limit
    const to   = from + limit - 1

    let q = this.supabase.getClient()
      .from('tax_invoices')
      .select('*, gst_line_items(count)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('invoice_date', { ascending: false })
      .range(from, to)

    if (eventId) q = q.eq('event_id', eventId)
    if (status)  q = q.eq('status', status)

    const { data, count, error } = await q
    if (error) throw new BadRequestException(error.message)

    return { data: data ?? [], total: count ?? 0, page, limit }
  }

  async getInvoiceById(tenantId: string, invoiceId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('tax_invoices')
      .select('*, gst_line_items(*)')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('Invoice not found')
    return data
  }

  async createInvoice(tenantId: string, createdBy: string, dto: CreateTaxInvoiceDto) {
    const client = this.supabase.getClient()

    // Get settings for supplier details + invoice numbering
    const settings = await this.getSettings(tenantId)
    if (!settings) throw new BadRequestException('GST settings not configured. Please set up your GST profile first.')

    // Generate invoice number
    const prefix  = dto.invoice_type === 'credit_note'
      ? settings.credit_note_prefix : settings.invoice_prefix
    const counter = dto.invoice_type === 'credit_note'
      ? settings.credit_note_counter : settings.invoice_counter
    const invoice_number = `${prefix}-${String(counter).padStart(4, '0')}`

    // Compute line item totals
    const { lineItems, totals } = this.computeLineItems(dto.line_items, dto.supply_type === 'Export')

    // Determine IGST
    const is_igst = dto.supply_type === 'Export' || dto.supply_type === 'SEZ' ||
      (settings.state_code && dto.place_of_supply && settings.state_code !== dto.place_of_supply)

    // Round off
    const raw_total   = totals.taxable_amount + totals.total_tax
    const grand_total = Math.round(raw_total)
    const round_off   = +(grand_total - raw_total).toFixed(2)

    // Insert invoice
    const { data: invoice, error: invErr } = await client
      .from('tax_invoices')
      .insert({
        tenant_id:       tenantId,
        event_id:        dto.event_id,
        invoice_number,
        invoice_type:    dto.invoice_type ?? 'tax_invoice',
        invoice_date:    dto.invoice_date ?? new Date().toISOString().split('T')[0],
        due_date:        dto.due_date,
        original_invoice_id: dto.original_invoice_id,
        supplier_gstin:  settings.gstin,
        supplier_name:   settings.legal_name ?? settings.trade_name,
        supplier_address: [settings.address_line1, settings.city, settings.state].filter(Boolean).join(', '),
        supplier_state_code: settings.state_code,
        buyer_name:      dto.buyer_name,
        buyer_gstin:     dto.buyer_gstin,
        buyer_address:   dto.buyer_address,
        buyer_state_code: dto.buyer_state_code,
        buyer_pan:       dto.buyer_pan,
        supply_type:     dto.supply_type ?? 'B2B',
        place_of_supply: dto.place_of_supply,
        is_igst,
        reverse_charge:  dto.reverse_charge ?? false,
        notes:           dto.notes,
        terms:           dto.terms,
        currency:        dto.currency ?? 'INR',
        created_by:      createdBy,
        ...totals,
        round_off,
        grand_total,
      })
      .select()
      .single()

    if (invErr) throw new BadRequestException(invErr.message)

    // Insert line items
    const { error: liErr } = await client
      .from('gst_line_items')
      .insert(lineItems.map((li, i) => ({ ...li, invoice_id: invoice.id, sort_order: i })))

    if (liErr) throw new BadRequestException(liErr.message)

    // Increment invoice counter
    const counterField = dto.invoice_type === 'credit_note' ? 'credit_note_counter' : 'invoice_counter'
    await client
      .from('gst_settings')
      .update({ [counterField]: counter + 1 })
      .eq('tenant_id', tenantId)

    return this.getInvoiceById(tenantId, invoice.id)
  }

  async updateInvoice(tenantId: string, invoiceId: string, dto: UpdateTaxInvoiceDto) {
    const existing = await this.getInvoiceById(tenantId, invoiceId)
    if (existing.status === 'finalized' || existing.status === 'cancelled') {
      throw new BadRequestException('Cannot edit a finalized or cancelled invoice')
    }

    const updates: Record<string, unknown> = { ...dto, updated_at: new Date().toISOString() }
    if (dto.status === 'finalized') updates.finalized_at = new Date().toISOString()
    if (dto.status === 'cancelled') updates.cancelled_at = new Date().toISOString()

    const { data, error } = await this.supabase.getClient()
      .from('tax_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async cancelInvoice(tenantId: string, invoiceId: string, reason: string) {
    const { data, error } = await this.supabase.getClient()
      .from('tax_invoices')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'sent'])
      .select()
      .single()

    if (error || !data) throw new BadRequestException(error?.message ?? 'Cannot cancel this invoice')
    return data
  }

  // ── GST Filings ────────────────────────────────────────────────────────────

  async getFilings(tenantId: string, year?: string) {
    let q = this.supabase.getClient()
      .from('gst_filings')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('tax_period', { ascending: false })

    if (year) q = q.like('tax_period', `%-${year}`)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createFiling(tenantId: string, dto: CreateFilingDto) {
    const { data, error } = await this.supabase.getClient()
      .from('gst_filings')
      .insert({ ...dto, tenant_id: tenantId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new ConflictException(`Filing for ${dto.return_type} ${dto.tax_period} already exists`)
      throw new BadRequestException(error.message)
    }
    return data
  }

  async updateFiling(tenantId: string, filingId: string, dto: UpdateFilingDto, userId: string) {
    const updates: Record<string, unknown> = { ...dto, updated_at: new Date().toISOString() }
    if (dto.status === 'filed' || dto.status === 'nil_filed') {
      updates.filed_by = userId
      if (!dto.filing_date) updates.filing_date = new Date().toISOString().split('T')[0]
    }

    const { data, error } = await this.supabase.getClient()
      .from('gst_filings')
      .update(updates)
      .eq('id', filingId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error || !data) throw new NotFoundException('Filing not found')
    return data
  }

  // ── ITC Ledger ─────────────────────────────────────────────────────────────

  async getItcLedger(tenantId: string, period?: string) {
    let q = this.supabase.getClient()
      .from('itc_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (period) q = q.eq('tax_period', period)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ── GST Reports ────────────────────────────────────────────────────────────

  /**
   * GSTR-1 export data — outward supplies grouped by supply type
   */
  async getGstr1Data(tenantId: string, taxPeriod: string) {
    const [month, year] = taxPeriod.split('-')
    const from = new Date(Number(year), Number(month) - 1, 1).toISOString().split('T')[0]
    const to   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

    const { data, error } = await this.supabase.getClient()
      .from('tax_invoices')
      .select('*, gst_line_items(*)')
      .eq('tenant_id', tenantId)
      .gte('invoice_date', from)
      .lte('invoice_date', to)
      .in('status', ['finalized', 'sent', 'paid'])
      .in('invoice_type', ['tax_invoice', 'credit_note', 'debit_note'])

    if (error) throw new BadRequestException(error.message)
    const invoices = data ?? []

    // Group by supply type
    const b2b      = invoices.filter(i => i.supply_type === 'B2B')
    const b2c_large = invoices.filter(i => i.supply_type === 'B2C' && Number(i.grand_total) >= 250000)
    const b2c_small = invoices.filter(i => i.supply_type === 'B2C' && Number(i.grand_total) < 250000)
    const exports  = invoices.filter(i => i.supply_type === 'Export')

    const sumInvoices = (list: typeof invoices) => list.reduce(
      (acc, inv) => {
        acc.taxable_value += Number(inv.taxable_amount)
        acc.igst          += Number(inv.igst_amount)
        acc.cgst          += Number(inv.cgst_amount)
        acc.sgst          += Number(inv.sgst_amount)
        acc.cess          += Number(inv.cess_amount)
        return acc
      },
      { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    )

    return {
      tax_period: taxPeriod,
      b2b:       { invoices: b2b,        summary: sumInvoices(b2b)       },
      b2c_large: { invoices: b2c_large,  summary: sumInvoices(b2c_large) },
      b2c_small: { invoices: b2c_small,  summary: sumInvoices(b2c_small) },
      exports:   { invoices: exports,    summary: sumInvoices(exports)   },
      totals:    sumInvoices(invoices),
    }
  }

  /**
   * GSTR-3B summary data
   */
  async getGstr3bData(tenantId: string, taxPeriod: string) {
    const gstr1 = await this.getGstr1Data(tenantId, taxPeriod)
    const itc   = await this.getItcLedger(tenantId, taxPeriod)

    const itcTotals = itc.reduce(
      (acc, r) => {
        const sign = r.entry_type === 'debit' || r.entry_type === 'reversal' ? -1 : 1
        acc.igst += sign * Number(r.igst_credit ?? 0)
        acc.cgst += sign * Number(r.cgst_credit ?? 0)
        acc.sgst += sign * Number(r.sgst_credit ?? 0)
        acc.cess += sign * Number(r.cess_credit ?? 0)
        return acc
      },
      { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    )

    return {
      tax_period:        taxPeriod,
      outward_supplies:  gstr1.totals,
      itc_available:     itcTotals,
      net_payable: {
        igst: Math.max(0, gstr1.totals.igst - itcTotals.igst),
        cgst: Math.max(0, gstr1.totals.cgst - itcTotals.cgst),
        sgst: Math.max(0, gstr1.totals.sgst - itcTotals.sgst),
        cess: Math.max(0, gstr1.totals.cess - itcTotals.cess),
      },
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private computeLineItems(items: CreateLineItemDto[], isIgst: boolean) {
    const lineItems = items.map(item => {
      const taxable = +(item.unit_price * item.quantity * (1 - (item.discount_pct ?? 0) / 100)).toFixed(2)
      const discount_amount = +(item.unit_price * item.quantity - taxable).toFixed(2)

      const cgst_r  = isIgst ? 0 : (item.cgst_rate ?? 0)
      const sgst_r  = isIgst ? 0 : (item.sgst_rate ?? 0)
      const igst_r  = isIgst ? ((item.cgst_rate ?? 0) + (item.sgst_rate ?? 0) + (item.igst_rate ?? 0)) : (item.igst_rate ?? 0)
      const utgst_r = item.utgst_rate ?? 0
      const cess_r  = item.cess_rate  ?? 0

      const cgst_amount  = +(taxable * cgst_r  / 100).toFixed(2)
      const sgst_amount  = +(taxable * sgst_r  / 100).toFixed(2)
      const igst_amount  = +(taxable * igst_r  / 100).toFixed(2)
      const utgst_amount = +(taxable * utgst_r / 100).toFixed(2)
      const cess_amount  = +(taxable * cess_r  / 100).toFixed(2)
      const total_tax    = cgst_amount + sgst_amount + igst_amount + utgst_amount + cess_amount
      const line_total   = +(taxable + total_tax).toFixed(2)

      return {
        description:     item.description,
        item_code:       item.item_code,
        hsn_sac_code:    item.hsn_sac_code,
        is_service:      item.is_service ?? true,
        quantity:        item.quantity,
        unit:            item.unit ?? 'nos',
        unit_price:      item.unit_price,
        discount_pct:    item.discount_pct ?? 0,
        discount_amount,
        taxable_amount:  taxable,
        tax_rate_id:     item.tax_rate_id,
        cgst_rate:  cgst_r,
        sgst_rate:  sgst_r,
        igst_rate:  igst_r,
        utgst_rate: utgst_r,
        cess_rate:  cess_r,
        cgst_amount,
        sgst_amount,
        igst_amount,
        utgst_amount,
        cess_amount,
        total_tax,
        line_total,
        is_nil_rated:     item.is_nil_rated    ?? false,
        is_exempt:        item.is_exempt       ?? false,
        is_reverse_charge: item.is_reverse_charge ?? false,
      }
    })

    const totals = lineItems.reduce(
      (acc, li) => {
        acc.subtotal        += li.unit_price * li.quantity
        acc.discount_amount += li.discount_amount
        acc.taxable_amount  += li.taxable_amount
        acc.cgst_amount     += li.cgst_amount
        acc.sgst_amount     += li.sgst_amount
        acc.igst_amount     += li.igst_amount
        acc.utgst_amount    += li.utgst_amount
        acc.cess_amount     += li.cess_amount
        acc.total_tax       += li.total_tax
        return acc
      },
      { subtotal: 0, discount_amount: 0, taxable_amount: 0,
        cgst_amount: 0, sgst_amount: 0, igst_amount: 0,
        utgst_amount: 0, cess_amount: 0, total_tax: 0 },
    )
    Object.keys(totals).forEach(k => {
      (totals as Record<string, number>)[k] = +((totals as Record<string, number>)[k]).toFixed(2)
    })

    return { lineItems, totals }
  }
}
