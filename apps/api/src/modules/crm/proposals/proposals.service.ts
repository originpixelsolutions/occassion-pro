import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class ProposalsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('proposals')
      .select(`*, client_companies(id, name), events(id, name)`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('proposals').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }
}
