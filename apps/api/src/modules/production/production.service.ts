import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class ProductionService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Production Dashboard ────────────────────────────────────────────────────

  async getProductionDashboard(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)

    const [setups, equipment, loadSchedule, suppliers] = await Promise.all([
      client
        .from('production_setups')
        .select(`
          *,
          responsible:profiles!production_setups_responsible_id_fkey(id, full_name, avatar_url),
          vendor:vendors!production_setups_vendor_id_fkey(id, name)
        `)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('created_at'),

      client
        .from('equipment_assignments')
        .select(`
          *,
          equipment:equipment_items(id, name, category, make, model),
          assigned_to:profiles!equipment_assignments_assigned_to_fkey(id, full_name)
        `)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),

      client
        .from('load_schedule')
        .select(`*, vendor:vendors!load_schedule_vendor_id_fkey(id, name)`)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('scheduled_time'),

      client
        .from('supplier_coordination')
        .select(`*, vendor:vendors(id, name, category, contact_email, contact_phone)`)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('created_at'),
    ])

    // Compute summary stats
    const setupStats = {
      total: setups.data?.length ?? 0,
      ready: setups.data?.filter(s => s.status === 'ready' || s.status === 'live').length ?? 0,
      in_setup: setups.data?.filter(s => s.status === 'in_setup').length ?? 0,
      pending: setups.data?.filter(s => s.status === 'pending').length ?? 0,
    }

    const supplierStats = {
      total: suppliers.data?.length ?? 0,
      confirmed: suppliers.data?.filter(s => s.confirmed).length ?? 0,
      briefed: suppliers.data?.filter(s => s.brief_sent).length ?? 0,
      on_site: suppliers.data?.filter(s => s.status === 'on_site').length ?? 0,
    }

    const now = new Date()
    const upcomingLoads = loadSchedule.data?.filter(
      l => new Date(l.scheduled_time) > now && l.status === 'scheduled'
    ).slice(0, 5) ?? []

    return {
      setups: setups.data ?? [],
      equipment: equipment.data ?? [],
      load_schedule: loadSchedule.data ?? [],
      suppliers: suppliers.data ?? [],
      stats: { setups: setupStats, suppliers: supplierStats },
      upcoming_loads: upcomingLoads,
    }
  }

  // ─── Production Setups ───────────────────────────────────────────────────────

  async getSetups(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('production_setups')
      .select(`
        *,
        responsible:profiles!production_setups_responsible_id_fkey(id, full_name, avatar_url),
        vendor:vendors!production_setups_vendor_id_fkey(id, name)
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('category')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertSetup(
    eventId: string,
    dto: {
      id?: string
      name: string
      category?: string
      description?: string
      location?: string
      status?: string
      setup_start?: string
      setup_end?: string
      teardown_start?: string
      teardown_end?: string
      responsible_id?: string
      vendor_id?: string
      notes?: string
      checklist?: any[]
    },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const payload = {
      ...dto,
      event_id: eventId,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
      .from('production_setups')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateSetupStatus(
    id: string,
    status: string,
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const update: any = { status, updated_at: new Date().toISOString() }
    if (status === 'live') update.setup_end = new Date().toISOString()
    if (status === 'done') update.teardown_end = new Date().toISOString()

    const { data, error } = await client
      .from('production_setups')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Setup not found')
    return data
  }

  async updateSetupChecklist(
    id: string,
    checklist: any[],
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('production_setups')
      .update({ checklist, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Setup not found')
    return data
  }

  // ─── Equipment ───────────────────────────────────────────────────────────────

  async getEquipmentInventory(tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('equipment_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('category')
      .order('name')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertEquipmentItem(
    dto: {
      id?: string
      name: string
      category?: string
      make?: string
      model?: string
      serial_number?: string
      quantity_owned?: number
      quantity_available?: number
      unit_cost?: number
      condition?: string
      notes?: string
    },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('equipment_items')
      .upsert({ ...dto, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getEventEquipment(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('equipment_assignments')
      .select(`
        *,
        equipment:equipment_items(id, name, category, make, model, serial_number),
        assigned_to:profiles!equipment_assignments_assigned_to_fkey(id, full_name),
        setup:production_setups(id, name)
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async assignEquipment(
    eventId: string,
    dto: {
      equipment_id: string
      setup_id?: string
      quantity?: number
      assigned_to?: string
      notes?: string
    },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('equipment_assignments')
      .insert({
        ...dto,
        event_id: eventId,
        tenant_id: tenantId,
        status: 'reserved',
      })
      .select(`
        *,
        equipment:equipment_items(id, name, category)
      `)
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateEquipmentStatus(
    assignmentId: string,
    status: string,
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const update: any = { status, updated_at: new Date().toISOString() }
    if (status === 'dispatched') update.dispatched_at = new Date().toISOString()
    if (status === 'returned') update.returned_at = new Date().toISOString()

    const { data, error } = await client
      .from('equipment_assignments')
      .update(update)
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Assignment not found')
    return data
  }

  // ─── Load Schedule ───────────────────────────────────────────────────────────

  async getLoadSchedule(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('load_schedule')
      .select(`*, vendor:vendors!load_schedule_vendor_id_fkey(id, name)`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('scheduled_time')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertLoadScheduleItem(
    eventId: string,
    dto: {
      id?: string
      type: string
      title: string
      description?: string
      scheduled_time: string
      duration_minutes?: number
      location?: string
      vendor_id?: string
      vehicle_info?: string
      contact_name?: string
      contact_phone?: string
      notes?: string
    },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('load_schedule')
      .upsert({
        ...dto,
        event_id: eventId,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select(`*, vendor:vendors!load_schedule_vendor_id_fkey(id, name)`)
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateLoadStatus(
    id: string,
    status: string,
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const update: any = { status, updated_at: new Date().toISOString() }
    if (status === 'arrived' || status === 'in_progress') {
      update.actual_time = new Date().toISOString()
    }
    const { data, error } = await client
      .from('load_schedule')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Schedule item not found')
    return data
  }

  // ─── Supplier Coordination ───────────────────────────────────────────────────

  async getSupplierCoordination(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('supplier_coordination')
      .select(`*, vendor:vendors(id, name, category, contact_email, contact_phone, logo_url)`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertSupplierCoordination(
    eventId: string,
    dto: {
      vendor_id: string
      category?: string
      brief_sent?: boolean
      confirmed?: boolean
      advance_paid?: boolean
      advance_amount?: number
      balance_due?: number
      arrival_time?: string
      departure_time?: string
      contact_name?: string
      contact_phone?: string
      requirements?: string
      notes?: string
      status?: string
    },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const now = new Date().toISOString()
    const payload: any = {
      ...dto,
      event_id: eventId,
      tenant_id: tenantId,
      updated_at: now,
    }
    if (dto.brief_sent && !payload.brief_sent_at) payload.brief_sent_at = now
    if (dto.confirmed && !payload.confirmed_at) payload.confirmed_at = now

    const { data, error } = await client
      .from('supplier_coordination')
      .upsert(payload, { onConflict: 'event_id,vendor_id' })
      .select(`*, vendor:vendors(id, name, category)`)
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async markSupplierBriefSent(id: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('supplier_coordination')
      .update({
        brief_sent: true,
        brief_sent_at: new Date().toISOString(),
        status: 'briefed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Coordination record not found')
    return data
  }

  async confirmSupplier(id: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('supplier_coordination')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Coordination record not found')
    return data
  }

  // ─── Checklist Templates ─────────────────────────────────────────────────────

  async getChecklistTemplates(tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('production_checklist_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createChecklistTemplate(
    dto: { name: string; category?: string; items: any[]; event_type?: string },
    tenantId: string,
    token: string,
  ) {
    const client = this.supabase.getAuthenticatedClient(token)
    const { data, error } = await client
      .from('production_checklist_templates')
      .insert({ ...dto, tenant_id: tenantId })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Production Summary for Event ────────────────────────────────────────────

  async getProductionReadinessReport(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const [setups, suppliers, equipment, loads] = await Promise.all([
      client.from('production_setups').select('id,name,status,checklist').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('supplier_coordination').select('id,status,confirmed,brief_sent').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('equipment_assignments').select('id,status').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('load_schedule').select('id,type,status,scheduled_time').eq('event_id', eventId).eq('tenant_id', tenantId),
    ])

    const setupReadiness = setups.data?.map(s => {
      const checklist = (s.checklist ?? []) as any[]
      const done = checklist.filter((c: any) => c.done).length
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        checklist_progress: checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0,
      }
    }) ?? []

    return {
      event_id: eventId,
      generated_at: new Date().toISOString(),
      setups: {
        total: setups.data?.length ?? 0,
        ready: setups.data?.filter(s => ['ready', 'live', 'done'].includes(s.status)).length ?? 0,
        items: setupReadiness,
      },
      suppliers: {
        total: suppliers.data?.length ?? 0,
        confirmed: suppliers.data?.filter(s => s.confirmed).length ?? 0,
        briefed: suppliers.data?.filter(s => s.brief_sent).length ?? 0,
      },
      equipment: {
        total: equipment.data?.length ?? 0,
        on_site: equipment.data?.filter(e => ['on_site', 'in_use'].includes(e.status)).length ?? 0,
      },
      load_schedule: {
        total: loads.data?.length ?? 0,
        completed: loads.data?.filter(l => l.status === 'completed').length ?? 0,
        upcoming: loads.data?.filter(l => l.status === 'scheduled').length ?? 0,
      },
    }
  }
}
