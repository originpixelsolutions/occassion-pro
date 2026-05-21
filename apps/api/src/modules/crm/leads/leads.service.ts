import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class LeadsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly emitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, token: string, options: any = {}) {
    const { page = 1, pageSize = 25, stage, assignedTo, search } = options
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const client = this.supabase.forRequest(token)

    let query = client
      .from('leads')
      .select(`
        *,
        client_companies(id, name, industry),
        contacts(id, full_name, email),
        assignee:profiles!leads_assigned_to_fkey(id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (stage) query = query.eq('stage', stage)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    return {
      data: data ?? [],
      count: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    }
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('leads').insert(dto).select().single()
    if (error) throw new Error(error.message)
    this.emitter.emit('lead.created', data)
    return data
  }

  async updateStage(id: string, tenantId: string, stage: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('leads')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error || !data) throw new NotFoundException(`Lead ${id} not found`)
    this.emitter.emit('lead.stage_changed', { lead: data, newStage: stage })
    return data
  }

  async addActivity(leadId: string, tenantId: string, dto: any, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('lead_activities')
      .insert({ ...dto, lead_id: leadId, tenant_id: tenantId, performed_by: userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getPipelineStats(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data } = await client
      .from('leads')
      .select('stage, estimated_value, currency')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '("won","lost")')

    const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation']
    const stats = stages.reduce<Record<string, any>>((acc, stage) => {
      const stageLeads = (data ?? []).filter((l) => l.stage === stage)
      acc[stage] = {
        count: stageLeads.length,
        value: stageLeads.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0),
      }
      return acc
    }, {})
    return stats
  }

  async findOne(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('leads')
      .select(`*, client_companies(id, name), contacts(id, full_name, email), assignee:profiles!leads_assigned_to_fkey(id, full_name)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error || !data) throw new NotFoundException(`Lead ${id} not found`)
    return data
  }

  async update(id: string, tenantId: string, dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('leads')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error || !data) throw new NotFoundException(`Lead ${id} not found`)
    return data
  }

  async remove(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new NotFoundException(`Lead ${id} not found`)
  }
}
