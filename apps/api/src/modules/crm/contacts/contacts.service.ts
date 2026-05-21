import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class ContactsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(tenantId: string, token: string, options: any = {}) {
    const { page = 1, pageSize = 25, search, companyId } = options
    const from = (page - 1) * pageSize
    const client = this.supabase.forRequest(token)
    let query = client
      .from('contacts')
      .select(`*, client_companies(id, name)`, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('full_name')
      .range(from, from + pageSize - 1)
    if (companyId) query = query.eq('company_id', companyId)
    if (search) query = query.ilike('full_name', `%${search}%`)
    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) }
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('contacts').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }
}
