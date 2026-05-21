import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class InventoryService {
  constructor(private readonly supabase: SupabaseService) {}

  async findItems(tenantId: string, token: string, options: any = {}) {
    const { search, category, status } = options
    const client = this.supabase.forRequest(token)
    let query = client
      .from('inventory_items')
      .select(`*, inventory_categories(name, color)`, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('name')
    if (category) query = query.eq('category_id', category)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('name', `%${search}%`)
    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0 }
  }

  async findOne(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('inventory_items')
      .select(`*, inventory_categories(name)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async createItem(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('inventory_items')
      .insert(dto)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateItem(id: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('inventory_items')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async adjustStock(
    id: string,
    adjustment: number,
    reason: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)
    // Get current quantity
    const { data: item, error: fetchErr } = await client
      .from('inventory_items')
      .select('id, quantity_available, quantity_total')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)

    const newQty = (item.quantity_available ?? 0) + adjustment
    if (newQty < 0) throw new Error('Stock adjustment would result in negative quantity')

    const { data, error } = await client
      .from('inventory_items')
      .update({
        quantity_available: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    // Log the adjustment
    await client.from('inventory_transactions').insert({
      item_id: id,
      tenant_id: tenantId,
      adjustment,
      reason,
      quantity_after: newQty,
      created_by: userId,
    })

    return data
  }

  // Event inventory allocations
  async getEventAllocations(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_inventory_allocations')
      .select(`*, inventory_items(id, name, sku, inventory_categories(name))`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async allocateToEvent(eventId: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_inventory_allocations')
      .upsert(
        { event_id: eventId, tenant_id: tenantId, ...dto },
        { onConflict: 'event_id,item_id' },
      )
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async findCategories(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('inventory_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async createCategory(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('inventory_categories')
      .insert(dto)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getLowStockAlerts(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('inventory_items')
      .select(`*, inventory_categories(name)`)
      .eq('tenant_id', tenantId)
      .filter('quantity_available', 'lte', 'reorder_level')
      .order('quantity_available')
    if (error) throw new Error(error.message)
    return data ?? []
  }
}
