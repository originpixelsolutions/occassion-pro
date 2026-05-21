import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

// ── Inlined DTOs (avoids cross-import issues in this module) ─────────────────

export interface SaveFloorPlanDto {
  shapes:       Record<string, unknown>[]
  canvasProps?: Record<string, unknown>
}

export interface CreateTableDto {
  name:       string
  seats:      number
  tableType:  string
  xPos?:      number
  yPos?:      number
}

export interface UpdateTableDto {
  name?:    string
  seats?:   number
  shapeId?: string
  xPos?:    number
  yPos?:    number
}

@Injectable()
export class FloorPlanService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Init: get-or-create floor plan ─────────────────────────────────────────
  async initFloorPlan(eventId: string, tenantId: string) {
    const db = this.supabase.serviceClient

    // Verify event belongs to tenant
    const { data: event } = await db
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (!event) throw new NotFoundException('Event not found')

    // Try existing first
    const { data: existing } = await db
      .from('floor_plans')
      .select()
      .eq('event_id', eventId)
      .maybeSingle()

    if (existing) return existing

    const { data: created, error } = await db
      .from('floor_plans')
      .insert({ event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return created
  }

  // ── Get full plan (shapes + tables + assignments) ───────────────────────────
  async getFloorPlan(eventId: string, tenantId: string) {
    const db = this.supabase.serviceClient

    const { data: fp, error } = await db
      .from('floor_plans')
      .select()
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw new BadRequestException(error.message)
    if (!fp) throw new NotFoundException('Floor plan not found')

    const { data: tables } = await db
      .from('floor_plan_tables')
      .select(`
        id, name, seats, table_type, shape_id, x_pos, y_pos, created_at,
        guests:floor_plan_table_guests (
          id, seat_number, assigned_at,
          guest:guests ( id, first_name, last_name, email, phone, rsvp_status )
        )
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at')

    return { ...fp, tables: tables ?? [] }
  }

  // ── Save shapes + canvasProps ───────────────────────────────────────────────
  async saveFloorPlan(
    eventId: string,
    tenantId: string,
    dto: SaveFloorPlanDto,
  ) {
    const db = this.supabase.serviceClient

    const { data: fp } = await db
      .from('floor_plans')
      .select('id')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!fp) throw new NotFoundException('Floor plan not found — call /init first')

    const patch: Record<string, unknown> = { shapes: dto.shapes }
    if (dto.canvasProps) patch['canvas_props'] = dto.canvasProps

    const { data, error } = await db
      .from('floor_plans')
      .update(patch)
      .eq('id', fp.id)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Unassigned confirmed guests ─────────────────────────────────────────────
  async getUnassignedGuests(eventId: string, tenantId: string) {
    const db = this.supabase.serviceClient

    // IDs of guests already seated
    const { data: seated } = await db
      .from('floor_plan_table_guests')
      .select('guest_id')
      .eq('event_id', eventId)

    const seatedIds = (seated ?? []).map((r: Record<string, string>) => r['guest_id'])

    let query = db
      .from('guests')
      .select('id, first_name, last_name, email, phone, rsvp_status, dietary_requirements, tags')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .in('rsvp_status', ['confirmed', 'attending', 'checked_in'])
      .order('last_name')
      .order('first_name')

    if (seatedIds.length > 0) {
      // Supabase supports NOT IN via `.not('id', 'in', '(id1,id2,...)')`
      query = (query as any).not('id', 'in', `(${seatedIds.join(',')})`)
    }

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ── Create table ────────────────────────────────────────────────────────────
  async createTable(eventId: string, tenantId: string, dto: CreateTableDto) {
    const db = this.supabase.serviceClient

    // Count existing tables for auto-naming
    const { count } = await db
      .from('floor_plan_tables')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)

    const { data, error } = await db
      .from('floor_plan_tables')
      .insert({
        event_id:   eventId,
        tenant_id:  tenantId,
        name:       dto.name || `Table ${(count ?? 0) + 1}`,
        seats:      dto.seats ?? 8,
        table_type: dto.tableType ?? 'table-round',
        x_pos:      dto.xPos ?? 400,
        y_pos:      dto.yPos ?? 300,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Update table ────────────────────────────────────────────────────────────
  async updateTable(
    eventId: string,
    tenantId: string,
    tableId: string,
    dto: UpdateTableDto,
  ) {
    const db = this.supabase.serviceClient

    const { data: table } = await db
      .from('floor_plan_tables')
      .select('id')
      .eq('id', tableId)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!table) throw new NotFoundException('Table not found')

    const patch: Record<string, unknown> = {}
    if (dto.name    !== undefined) patch['name']     = dto.name
    if (dto.seats   !== undefined) patch['seats']    = dto.seats
    if (dto.shapeId !== undefined) patch['shape_id'] = dto.shapeId
    if (dto.xPos    !== undefined) patch['x_pos']    = dto.xPos
    if (dto.yPos    !== undefined) patch['y_pos']    = dto.yPos

    const { data, error } = await db
      .from('floor_plan_tables')
      .update(patch)
      .eq('id', tableId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Delete table ────────────────────────────────────────────────────────────
  async deleteTable(eventId: string, tenantId: string, tableId: string) {
    const db = this.supabase.serviceClient

    const { data: table } = await db
      .from('floor_plan_tables')
      .select('id')
      .eq('id', tableId)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!table) throw new NotFoundException('Table not found')

    // floor_plan_table_guests cascade-deletes via FK
    const { error } = await db.from('floor_plan_tables').delete().eq('id', tableId)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ── Assign guest to table ───────────────────────────────────────────────────
  async assignGuest(
    eventId: string,
    tenantId: string,
    tableId: string,
    guestId: string,
  ) {
    const db = this.supabase.serviceClient

    // Verify table + capacity
    const { data: table } = await db
      .from('floor_plan_tables')
      .select('id, seats')
      .eq('id', tableId)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (!table) throw new NotFoundException('Table not found')

    const { count: currentCount } = await db
      .from('floor_plan_table_guests')
      .select('id', { count: 'exact', head: true })
      .eq('table_id', tableId)

    if ((currentCount ?? 0) >= table.seats) {
      throw new ConflictException('Table is at full capacity')
    }

    // Verify guest
    const { data: guest } = await db
      .from('guests')
      .select('id')
      .eq('id', guestId)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (!guest) throw new NotFoundException('Guest not found')

    // Remove from any previous table assignment (guest moves tables)
    await db
      .from('floor_plan_table_guests')
      .delete()
      .eq('event_id', eventId)
      .eq('guest_id', guestId)

    const { data, error } = await db
      .from('floor_plan_table_guests')
      .insert({
        table_id:    tableId,
        event_id:    eventId,
        tenant_id:   tenantId,
        guest_id:    guestId,
        seat_number: (currentCount ?? 0) + 1,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Unassign guest from table ───────────────────────────────────────────────
  async unassignGuest(
    eventId: string,
    tenantId: string,
    tableId: string,
    guestId: string,
  ) {
    const { error } = await this.supabase.serviceClient
      .from('floor_plan_table_guests')
      .delete()
      .eq('table_id', tableId)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .eq('guest_id', guestId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ── Auto-assign via DB function ─────────────────────────────────────────────
  async autoAssign(eventId: string, tenantId: string) {
    const { data, error } = await this.supabase.serviceClient.rpc(
      'auto_assign_guests',
      { p_event_id: eventId, p_tenant_id: tenantId },
    )

    if (error) throw new BadRequestException(error.message)
    return { assigned: data as number }
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  async publishFloorPlan(eventId: string, tenantId: string) {
    const { data: fp } = await this.supabase.serviceClient
      .from('floor_plans')
      .select('id')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!fp) throw new NotFoundException('Floor plan not found')

    const { data, error } = await this.supabase.serviceClient
      .from('floor_plans')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('id', fp.id)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Seating chart export ────────────────────────────────────────────────────
  async exportSeatingChart(eventId: string, tenantId: string) {
    const plan = await this.getFloorPlan(eventId, tenantId)

    return (plan.tables ?? []).map((t: Record<string, unknown>) => ({
      table:    t['name'],
      seats:    t['seats'],
      assigned: (t['guests'] as unknown[]).length,
      guests:   (t['guests'] as Array<Record<string, unknown>>).map((a) => {
        const g = a['guest'] as Record<string, unknown>
        return {
          name:        `${g['first_name']} ${g['last_name']}`,
          email:       g['email'],
          rsvp_status: g['rsvp_status'],
          seat_number: a['seat_number'],
        }
      }),
    }))
  }
}
