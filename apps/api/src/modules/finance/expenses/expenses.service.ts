import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class ExpensesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(tenantId: string, token: string, options: any = {}) {
    const { category, status } = options
    const client = this.supabase.forRequest(token)
    let query = client
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
    if (category) query = query.eq('category', category)
    if (status) query = query.eq('status', status)
    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { data: data ?? [], total: count ?? 0 }
  }

  async findOne(id: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('expenses').select('*').eq('id', id).single()
    if (error) throw new Error(error.message)
    return data
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('expenses').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('expenses')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async remove(id: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('expenses').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}
