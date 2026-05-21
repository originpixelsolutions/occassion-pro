import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class VenuesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(tenantId: string, token: string, options: any = {}) {
    const { search, city } = options
    const client = this.supabase.forRequest(token)
    let query = client.from('venues').select('*', { count: 'exact' }).eq('tenant_id', tenantId).order('name')
    if (city) query = query.ilike('city', `%${city}%`)
    if (search) query = query.ilike('name', `%${search}%`)
    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0 }
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('venues').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async findOne(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('venues').select('*').eq('id', id).eq('tenant_id', tenantId).single()
    if (error || !data) throw new Error(`Venue ${id} not found`)
    return data
  }

  async update(id: string, tenantId: string, dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('venues')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error || !data) throw new Error(`Venue ${id} not found`)
    return data
  }

  async remove(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('venues').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }
}
