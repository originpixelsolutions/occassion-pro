import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class PrintingService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(token: string) { return this.supabase.forRequest(token) }
  private svc() { return this.supabase.serviceClient }

  async getStats(eventId: string, tenantId: string, token: string) {
    const client = this.client(token)
    const { data } = await client
      .from('print_items')
      .select('design_status, quantity, total_cost')
      .eq('event_id', eventId)

    const items = data ?? []
    const statusCounts: Record<string, number> = {}
    let totalItems = 0, totalQuantity = 0, totalCost = 0, pendingApproval = 0

    for (const i of items) {
      statusCounts[i.design_status] = (statusCounts[i.design_status] ?? 0) + 1
      totalItems++
      totalQuantity += i.quantity ?? 0
      totalCost += Number(i.total_cost ?? 0)
      if (i.design_status === 'design_review') pendingApproval++
    }

    return { totalItems, totalQuantity, totalCost, pendingApproval, statusCounts }
  }

  async list(eventId: string, tenantId: string, token: string, filters: { type?: string; status?: string }) {
    const client = this.client(token)
    let query = client
      .from('print_items')
      .select('*, vendors(name, category)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (filters.type) query = query.eq('item_type', filters.type)
    if (filters.status) query = query.eq('design_status', filters.status)

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  }

  async create(tenantId: string, token: string, body: Record<string, unknown>) {
    const client = this.client(token)
    const { data: profile } = await client.from('profiles').select('id').single()
    const { data, error } = await client
      .from('print_items')
      .insert({ ...body, tenant_id: tenantId, created_by: profile?.id })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async update(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const client = this.client(token)
    const { data, error } = await client
      .from('print_items')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async delete(id: string, tenantId: string, token: string) {
    const client = this.client(token)
    const { error } = await client.from('print_items').delete().eq('id', id)
    if (error) throw error
  }
}
