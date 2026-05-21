import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class PlaybooksService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(token: string) { return this.supabase.forRequest(token) }

  private async getUser(token: string) {
    const client = this.client(token)
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new BadRequestException('Unauthenticated')
    const { data: profile } = await client.from('profiles')
      .select('tenant_id,role').eq('id', user.id).single()
    return { userId: user.id, tenantId: profile?.tenant_id as string, role: profile?.role as string }
  }

  // ── LIST ─────────────────────────────────────────────────────────────────

  async listPlaybooks(token: string, filters?: {
    eventType?: string
    category?: string
    search?: string
    includeSystem?: boolean
  }) {
    const { tenantId } = await this.getUser(token)
    const client = this.client(token)

    let q = client
      .from('event_playbooks')
      .select('*')
      .eq('is_active', true)
      .order('is_system', { ascending: false })
      .order('times_applied', { ascending: false })

    if (filters?.eventType) q = q.eq('event_type', filters.eventType)
    if (filters?.category)  q = q.eq('category', filters.category)
    if (filters?.search)    q = q.ilike('name', `%${filters.search}%`)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)

    return data ?? []
  }

  // ── GET DETAIL ───────────────────────────────────────────────────────────

  async getPlaybook(id: string, token: string) {
    const client = this.client(token)

    const [pbRes, tasksRes, budgetRes, vendorRes, checklistRes, runsheetRes] = await Promise.all([
      client.from('event_playbooks').select('*').eq('id', id).single(),
      client.from('playbook_tasks').select('*').eq('playbook_id', id).order('sort_order'),
      client.from('playbook_budget_items').select('*').eq('playbook_id', id).order('sort_order'),
      client.from('playbook_vendor_requirements').select('*').eq('playbook_id', id).order('sort_order'),
      client.from('playbook_checklist_items').select('*').eq('playbook_id', id).order('sort_order'),
      client.from('playbook_runsheet_items').select('*').eq('playbook_id', id).order('sort_order'),
    ])

    if (pbRes.error || !pbRes.data) throw new NotFoundException('Playbook not found')

    return {
      ...pbRes.data,
      tasks:            tasksRes.data ?? [],
      budget_items:     budgetRes.data ?? [],
      vendor_requirements: vendorRes.data ?? [],
      checklist_items:  checklistRes.data ?? [],
      runsheet_items:   runsheetRes.data ?? [],
    }
  }

  // ── CREATE ───────────────────────────────────────────────────────────────

  async createPlaybook(token: string, dto: {
    name: string
    description?: string
    event_type: string
    category?: string
    tags?: string[]
    estimated_budget_min?: number
    estimated_budget_max?: number
    typical_guest_count?: number
    typical_duration_days?: number
    cover_emoji?: string
    color?: string
  }) {
    const { tenantId, userId } = await this.getUser(token)
    const { data, error } = await this.client(token)
      .from('event_playbooks')
      .insert({ ...dto, tenant_id: tenantId, created_by: userId, is_system: false })
      .select('*')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────

  async updatePlaybook(id: string, token: string, dto: Partial<{
    name: string; description: string; event_type: string; category: string
    tags: string[]; estimated_budget_min: number; estimated_budget_max: number
    typical_guest_count: number; typical_duration_days: number
    cover_emoji: string; color: string; is_active: boolean
  }>) {
    const { tenantId } = await this.getUser(token)
    const { data, error } = await this.client(token)
      .from('event_playbooks')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)  // can only edit own playbooks
      .select('*').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── DELETE ───────────────────────────────────────────────────────────────

  async deletePlaybook(id: string, token: string) {
    const { tenantId } = await this.getUser(token)
    const { error } = await this.client(token)
      .from('event_playbooks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_system', false)  // cannot delete system playbooks
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── MANAGE ITEMS ─────────────────────────────────────────────────────────

  async addTask(playbookId: string, token: string, dto: {
    title: string; description?: string; category?: string; priority?: string
    responsible_role?: string; days_before_event?: number; time_of_day?: string
    estimated_hours?: number; sort_order?: number; tags?: string[]
  }) {
    const { data, error } = await this.client(token)
      .from('playbook_tasks')
      .insert({ ...dto, playbook_id: playbookId })
      .select('*').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addBudgetItem(playbookId: string, token: string, dto: {
    category: string; name: string; description?: string
    amount_type?: string; amount?: number; is_mandatory?: boolean
    notes?: string; sort_order?: number
  }) {
    const { data, error } = await this.client(token)
      .from('playbook_budget_items')
      .insert({ ...dto, playbook_id: playbookId })
      .select('*').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addVendorRequirement(playbookId: string, token: string, dto: {
    vendor_type: string; name: string; description?: string
    is_mandatory?: boolean; quantity_needed?: number
    budget_percentage?: number; days_before_event?: number
    notes?: string; sort_order?: number
  }) {
    const { data, error } = await this.client(token)
      .from('playbook_vendor_requirements')
      .insert({ ...dto, playbook_id: playbookId })
      .select('*').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addChecklistItem(playbookId: string, token: string, dto: {
    title: string; description?: string; category?: string
    is_mandatory?: boolean; days_before_event?: number; sort_order?: number
  }) {
    const { data, error } = await this.client(token)
      .from('playbook_checklist_items')
      .insert({ ...dto, playbook_id: playbookId })
      .select('*').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addRunsheetItem(playbookId: string, token: string, dto: {
    title: string; description?: string; category?: string
    offset_hours?: number; duration_minutes?: number
    responsible_role?: string; location?: string; notes?: string; sort_order?: number
  }) {
    const { data, error } = await this.client(token)
      .from('playbook_runsheet_items')
      .insert({ ...dto, playbook_id: playbookId })
      .select('*').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteItem(table: string, id: string, token: string) {
    const validTables = ['playbook_tasks','playbook_budget_items','playbook_vendor_requirements','playbook_checklist_items','playbook_runsheet_items']
    if (!validTables.includes(table)) throw new BadRequestException('Invalid table')
    const { error } = await this.client(token).from(table as any).delete().eq('id', id)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── APPLY PLAYBOOK TO EVENT ───────────────────────────────────────────────

  async applyToEvent(
    playbookId: string,
    eventId: string,
    token: string,
    options: {
      applyTasks?: boolean
      applyBudget?: boolean
      applyVendors?: boolean
      applyChecklist?: boolean
      applyRunsheet?: boolean
      eventDate?: string    // ISO date string for relative calculations
    } = {},
  ) {
    const { tenantId, userId } = await this.getUser(token)
    const client = this.client(token)

    const pb = await this.getPlaybook(playbookId, token)
    if (!pb) throw new NotFoundException('Playbook not found')

    const eventDate = options.eventDate ? new Date(options.eventDate) : null
    const apply = {
      tasks:     options.applyTasks     !== false,
      budget:    options.applyBudget    !== false,
      vendors:   options.applyVendors   !== false,
      checklist: options.applyChecklist !== false,
      runsheet:  options.applyRunsheet  !== false,
    }

    const counts = { tasks: 0, budget_items: 0, vendors: 0, checklist: 0, runsheet: 0 }

    // ── Tasks
    if (apply.tasks && pb.tasks.length > 0) {
      const rows = pb.tasks.map((t: any) => {
        let dueDate: string | null = null
        if (eventDate && t.days_before_event !== null) {
          const d = new Date(eventDate)
          d.setDate(d.getDate() - (t.days_before_event ?? 0))
          dueDate = d.toISOString()
        }
        return {
          tenant_id: tenantId,
          event_id: eventId,
          title: t.title,
          description: t.description ?? null,
          category: t.category ?? 'general',
          priority: t.priority ?? 'medium',
          assigned_role: t.responsible_role ?? null,
          due_date: dueDate,
          tags: t.tags ?? [],
          status: 'pending',
          source: 'playbook',
        }
      })
      const { error } = await client.from('event_tasks').insert(rows)
      if (!error) counts.tasks = rows.length
    }

    // ── Budget Items
    if (apply.budget && pb.budget_items.length > 0) {
      const rows = pb.budget_items.map((b: any) => ({
        tenant_id: tenantId,
        event_id: eventId,
        category: b.category,
        name: b.name,
        description: b.description ?? null,
        amount_type: b.amount_type,
        budgeted_amount: b.amount_type === 'fixed' ? b.amount : null,
        budget_percentage: b.amount_type === 'percentage' ? b.amount : null,
        is_mandatory: b.is_mandatory,
        notes: b.notes ?? null,
        status: 'planned',
      }))
      const { error } = await client.from('budget_line_items').insert(rows)
      if (!error) counts.budget_items = rows.length
    }

    // ── Vendor Requirements (create placeholder vendor contract stubs)
    if (apply.vendors && pb.vendor_requirements.length > 0) {
      // We create vendor_requirements records, not contracts, since no vendor is assigned yet
      const rows = pb.vendor_requirements.map((v: any) => ({
        tenant_id: tenantId,
        event_id: eventId,
        vendor_type: v.vendor_type,
        name: v.name,
        description: v.description ?? null,
        is_mandatory: v.is_mandatory,
        quantity_needed: v.quantity_needed ?? 1,
        budget_percentage: v.budget_percentage ?? null,
        status: 'open',
        notes: v.notes ?? null,
        deadline: eventDate && v.days_before_event
          ? (() => { const d = new Date(eventDate); d.setDate(d.getDate() - v.days_before_event); return d.toISOString() })()
          : null,
      }))
      const { error } = await client.from('playbook_vendor_requirements').insert(rows)
      if (!error) counts.vendors = rows.length
    }

    // ── Checklist
    if (apply.checklist && pb.checklist_items.length > 0) {
      const rows = pb.checklist_items.map((c: any) => ({
        tenant_id: tenantId,
        event_id: eventId,
        title: c.title,
        description: c.description ?? null,
        category: c.category ?? 'general',
        is_mandatory: c.is_mandatory,
        due_date: eventDate && c.days_before_event !== null
          ? (() => { const d = new Date(eventDate); d.setDate(d.getDate() - c.days_before_event); return d.toISOString() })()
          : null,
        is_completed: false,
      }))
      const { error } = await client.from('playbook_checklist_items').insert(rows)
      if (!error) counts.checklist = rows.length
    }

    // ── Runsheet
    if (apply.runsheet && pb.runsheet_items.length > 0) {
      const rows = pb.runsheet_items.map((r: any) => {
        const scheduledTime = eventDate
          ? new Date(eventDate.getTime() + r.offset_hours * 3600000).toISOString()
          : null
        return {
          tenant_id: tenantId,
          event_id: eventId,
          title: r.title,
          description: r.description ?? null,
          category: r.category ?? 'general',
          scheduled_time: scheduledTime,
          duration_minutes: r.duration_minutes ?? 30,
          responsible_role: r.responsible_role ?? null,
          location: r.location ?? null,
          notes: r.notes ?? null,
          status: 'pending',
        }
      })
      const { error } = await client.from('runsheet_items').insert(rows)
      if (!error) counts.runsheet = rows.length
    }

    // ── Log application
    await this.supabase.serviceClient.from('event_playbook_applications').insert({
      playbook_id: playbookId,
      event_id: eventId,
      tenant_id: tenantId,
      applied_by: userId,
      tasks_created: counts.tasks,
      budget_items_created: counts.budget_items,
      vendors_created: counts.vendors,
      checklist_created: counts.checklist,
      runsheet_created: counts.runsheet,
    })

    // ── Increment usage counter
    await this.supabase.serviceClient.from('event_playbooks')
      .update({ times_applied: pb.times_applied + 1, last_applied_at: new Date().toISOString() })
      .eq('id', playbookId)

    return { applied: true, playbook: pb.name, event_id: eventId, counts }
  }

  // ── CREATE PLAYBOOK FROM EXISTING EVENT ──────────────────────────────────

  async createFromEvent(eventId: string, token: string, dto: {
    name: string
    description?: string
  }) {
    const { tenantId, userId } = await this.getUser(token)
    const client = this.client(token)

    // Fetch event data
    const { data: event } = await client.from('events').select('*').eq('id', eventId).single()
    if (!event) throw new NotFoundException('Event not found')

    const [tasksRes, budgetRes] = await Promise.all([
      client.from('event_tasks').select('title,description,category,priority,assigned_role,tags')
        .eq('event_id', eventId).eq('tenant_id', tenantId).limit(100),
      client.from('budget_line_items').select('category,name,description,budgeted_amount,is_mandatory,notes')
        .eq('event_id', eventId).eq('tenant_id', tenantId).limit(50),
    ])

    // Create the playbook
    const { data: pb, error: pbError } = await client.from('event_playbooks').insert({
      tenant_id: tenantId,
      created_by: userId,
      name: dto.name,
      description: dto.description ?? `Created from event: ${event.name}`,
      event_type: event.event_type ?? 'general',
      is_system: false,
    }).select('*').single()

    if (pbError || !pb) throw new BadRequestException(pbError?.message ?? 'Failed to create playbook')

    // Copy tasks
    if (tasksRes.data?.length) {
      const taskRows = tasksRes.data.map((t: any, i: number) => ({
        playbook_id: pb.id,
        title: t.title,
        description: t.description ?? null,
        category: t.category ?? 'general',
        priority: t.priority ?? 'medium',
        responsible_role: t.assigned_role ?? null,
        tags: t.tags ?? [],
        sort_order: i * 10,
      }))
      await client.from('playbook_tasks').insert(taskRows)
    }

    // Copy budget items
    if (budgetRes.data?.length) {
      const budgetRows = budgetRes.data.map((b: any, i: number) => ({
        playbook_id: pb.id,
        category: b.category ?? 'general',
        name: b.name,
        description: b.description ?? null,
        amount_type: 'fixed',
        amount: b.budgeted_amount ?? null,
        is_mandatory: b.is_mandatory ?? false,
        notes: b.notes ?? null,
        sort_order: i * 10,
      }))
      await client.from('playbook_budget_items').insert(budgetRows)
    }

    return this.getPlaybook(pb.id, token)
  }

  // ── APPLICATION HISTORY ──────────────────────────────────────────────────

  async getApplicationHistory(token: string, options: { eventId?: string; playbookId?: string }) {
    const { tenantId } = await this.getUser(token)
    let q = this.client(token)
      .from('event_playbook_applications')
      .select('*, event_playbooks(name, event_type, cover_emoji), events(name, event_date)')
      .eq('tenant_id', tenantId)
      .order('applied_at', { ascending: false })
      .limit(50)

    if (options.eventId)    q = q.eq('event_id', options.eventId)
    if (options.playbookId) q = q.eq('playbook_id', options.playbookId)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }
}
