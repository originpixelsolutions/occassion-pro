/**
 * Public External API — /api/v1/*
 *
 * Third-party integrations authenticate with X-API-Key (or Bearer <key>).
 * Every response is wrapped in the standard envelope:
 *   { data, meta: { api_version, tenant_id, timestamp }, pagination? }
 *
 * Rate limiting is enforced by ApiKeyGuard (reads rate_limit_rpm from the key).
 * Usage is logged at the end of each request via ApiKeysService.logUsage().
 */
import {
  Controller, Get, Post, Patch,
  Body, Param, Query, Req, Res, UseGuards,
  HttpCode, HttpStatus,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiKeyGuard, RequireScope } from './api-key.guard'
import { ApiKeysService } from './api-keys.service'
import { SupabaseService } from '../../common/supabase/supabase.service'

// ─── Envelope helpers ─────────────────────────────────────────────────────────

function envelope(
  data: any,
  tenantId: string,
  pagination?: { page: number; per_page: number; total: number },
) {
  return {
    data,
    meta: {
      api_version: 'v1',
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
    },
    ...(pagination ? { pagination } : {}),
  }
}

function paginate(query: any, page: number, perPage: number) {
  const from = (page - 1) * perPage
  return query.range(from, from + perPage - 1)
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('api/v1')
@UseGuards(ApiKeyGuard)
export class PublicApiV1Controller {
  constructor(
    private readonly keysSvc: ApiKeysService,
    private readonly supabase: SupabaseService,
  ) {}

  // ═══════════════════════════════════════════
  // Health / Info
  // ═══════════════════════════════════════════

  @Get()
  info(@Req() req: any) {
    return envelope(
      {
        message: 'OccasionPro API v1',
        scopes: req.apiKey?.scopes ?? [],
        key_name: req.apiKey?.name,
        environment: req.apiKey?.environment,
      },
      req.tenantId,
    )
  }

  // ═══════════════════════════════════════════
  // Events
  // ═══════════════════════════════════════════

  @Get('events')
  @RequireScope('events:read')
  async listEvents(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('status') status?: string,
  ) {
    const client = this.supabase.getServiceClient()
    let q = client
      .from('events')
      .select('id,name,event_type,status,start_date,end_date,venue_name,city,expected_guests', { count: 'exact' })
      .eq('tenant_id', req.tenantId)
      .order('start_date', { ascending: false })

    if (status) q = q.eq('status', status)
    q = paginate(q, page, perPage)

    const { data, count, error } = await q
    if (error) throw error

    return envelope(data, req.tenantId, { page, per_page: perPage, total: count ?? 0 })
  }

  @Get('events/:id')
  @RequireScope('events:read')
  async getEvent(@Req() req: any, @Param('id') id: string) {
    const { data, error } = await this.supabase.getServiceClient()
      .from('events')
      .select(`
        id, name, event_type, status, start_date, end_date,
        venue_name, city, timezone, expected_guests, description,
        total_budget, currency_code
      `)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .single()

    if (error || !data) {
      return { error: 'Event not found', status: 404 }
    }
    return envelope(data, req.tenantId)
  }

  // ═══════════════════════════════════════════
  // Guests
  // ═══════════════════════════════════════════

  @Get('events/:eventId/guests')
  @RequireScope('guests:read')
  async listGuests(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
    @Query('rsvp_status') rsvpStatus?: string,
  ) {
    const client = this.supabase.getServiceClient()
    let q = client
      .from('guests')
      .select(
        'id,first_name,last_name,email,phone,rsvp_status,category,table_number,checked_in,checked_in_at',
        { count: 'exact' },
      )
      .eq('event_id', eventId)
      .eq('tenant_id', req.tenantId)
      .order('last_name')

    if (rsvpStatus) q = q.eq('rsvp_status', rsvpStatus)
    q = paginate(q, page, perPage)

    const { data, count, error } = await q
    if (error) throw error

    return envelope(data, req.tenantId, { page, per_page: perPage, total: count ?? 0 })
  }

  @Post('events/:eventId/guests')
  @RequireScope('guests:write')
  async createGuest(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Body() body: {
      first_name: string
      last_name?: string
      email?: string
      phone?: string
      category?: string
      table_number?: string
      dietary_preferences?: string
      notes?: string
    },
  ) {
    const { data, error } = await this.supabase.getServiceClient()
      .from('guests')
      .insert({ ...body, event_id: eventId, tenant_id: req.tenantId })
      .select()
      .single()

    if (error) return { error: error.message, status: 400 }
    return envelope(data, req.tenantId)
  }

  // ═══════════════════════════════════════════
  // RSVP
  // ═══════════════════════════════════════════

  @Post('events/:eventId/guests/:guestId/rsvp')
  @HttpCode(HttpStatus.OK)
  @RequireScope('rsvp:write')
  async submitRsvp(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() body: {
      status: 'confirmed' | 'declined' | 'tentative'
      dietary_preferences?: string
      plus_ones?: number
      notes?: string
    },
  ) {
    const { data, error } = await this.supabase.getServiceClient()
      .from('guests')
      .update({
        rsvp_status: body.status,
        dietary_preferences: body.dietary_preferences,
        plus_ones: body.plus_ones,
        rsvp_notes: body.notes,
        rsvp_at: new Date().toISOString(),
      })
      .eq('id', guestId)
      .eq('event_id', eventId)
      .eq('tenant_id', req.tenantId)
      .select('id,rsvp_status,rsvp_at')
      .single()

    if (error || !data) return { error: 'Guest not found', status: 404 }
    return envelope(data, req.tenantId)
  }

  // ═══════════════════════════════════════════
  // Check-in
  // ═══════════════════════════════════════════

  @Post('events/:eventId/guests/:guestId/checkin')
  @HttpCode(HttpStatus.OK)
  @RequireScope('checkin:write')
  async checkIn(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() body: { method?: string; note?: string },
  ) {
    const now = new Date().toISOString()
    const { data, error } = await this.supabase.getServiceClient()
      .from('guests')
      .update({
        checked_in: true,
        checked_in_at: now,
        checkin_method: body.method ?? 'api',
        checkin_note: body.note,
      })
      .eq('id', guestId)
      .eq('event_id', eventId)
      .eq('tenant_id', req.tenantId)
      .select('id,first_name,last_name,checked_in,checked_in_at')
      .single()

    if (error || !data) return { error: 'Guest not found', status: 404 }
    return envelope(data, req.tenantId)
  }

  // ═══════════════════════════════════════════
  // Analytics summary
  // ═══════════════════════════════════════════

  @Get('events/:eventId/analytics')
  @RequireScope('analytics:read')
  async getAnalytics(@Req() req: any, @Param('eventId') eventId: string) {
    const client = this.supabase.getServiceClient()

    const [guestsRes, vendorsRes, budgetRes] = await Promise.all([
      client
        .from('guests')
        .select('rsvp_status,checked_in', { count: 'exact' })
        .eq('event_id', eventId)
        .eq('tenant_id', req.tenantId),
      client
        .from('vendor_event_assignments')
        .select('id', { count: 'exact' })
        .eq('event_id', eventId),
      client
        .from('event_budget_items')
        .select('estimated_cost,actual_cost')
        .eq('event_id', eventId),
    ])

    const guests = guestsRes.data ?? []
    const summary = {
      total_guests: guestsRes.count ?? 0,
      confirmed: guests.filter((g: any) => g.rsvp_status === 'confirmed').length,
      declined: guests.filter((g: any) => g.rsvp_status === 'declined').length,
      checked_in: guests.filter((g: any) => g.checked_in).length,
      total_vendors: vendorsRes.count ?? 0,
      budget_estimated: (budgetRes.data ?? []).reduce((s: number, b: any) => s + (b.estimated_cost ?? 0), 0),
      budget_actual: (budgetRes.data ?? []).reduce((s: number, b: any) => s + (b.actual_cost ?? 0), 0),
    }

    return envelope(summary, req.tenantId)
  }

  // ═══════════════════════════════════════════
  // Vendors (read-only)
  // ═══════════════════════════════════════════

  @Get('events/:eventId/vendors')
  @RequireScope('vendors:read')
  async listVendors(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    let q = this.supabase.getServiceClient()
      .from('vendor_event_assignments')
      .select(
        'id,role,status,contract_value,vendor:vendors(id,name,category,email,phone)',
        { count: 'exact' },
      )
      .eq('event_id', eventId)
    q = paginate(q, page, perPage)

    const { data, count, error } = await q
    if (error) throw error
    return envelope(data, req.tenantId, { page, per_page: perPage, total: count ?? 0 })
  }
}
