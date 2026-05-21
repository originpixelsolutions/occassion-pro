import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class RunsheetService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByEvent(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_runsheet')
      .select(`
        *,
        vendor:vendors(id, name),
        assigned_to:profiles(id, full_name, avatar_url)
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: true })

    if (error) throw new Error(error.message)
    return data ?? []
  }

  async upsert(items: any[], token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_runsheet')
      .upsert(items, { onConflict: 'id' })
      .select()
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async reorder(reorderData: { id: string; order_index: number }[], tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const updates = reorderData.map(({ id, order_index }) =>
      client.from('event_runsheet').update({ order_index }).eq('id', id).eq('tenant_id', tenantId)
    )
    await Promise.all(updates)
    return { message: 'Runsheet reordered' }
  }
}
