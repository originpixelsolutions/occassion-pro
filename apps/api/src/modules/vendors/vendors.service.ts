import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class VendorsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(tenantId: string, token: string, options: any = {}) {
    const { search, category, status } = options
    const client = this.supabase.forRequest(token)
    let query = client
      .from('vendors')
      .select(`*, vendor_categories(name, color)`, { count: 'exact' })
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
      .from('vendors')
      .select(`*, vendor_categories(name, color), vendor_contracts(*)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('vendors').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendors')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async approve(id: string, tenantId: string, token: string) {
    return this.update(id, { status: 'approved' }, tenantId, token)
  }

  async findCategories(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async createCategory(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_categories')
      .insert(dto)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // Event-vendor assignments
  async assignToEvent(eventId: string, vendorId: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_event_assignments')
      .upsert(
        { event_id: eventId, vendor_id: vendorId, tenant_id: tenantId, ...dto },
        { onConflict: 'event_id,vendor_id' },
      )
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getEventVendors(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_event_assignments')
      .select(`*, vendors(id, name, contact_name, contact_email, contact_phone, vendor_categories(name))`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async remove(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('vendors').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }
}
