import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class ContractsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByVendor(vendorId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_contracts')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findByEvent(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_contracts')
      .select(`*, vendors(id, name, contact_name)`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findOne(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_contracts')
      .select(`*, vendors(id, name, contact_name, contact_email)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_contracts')
      .insert(dto)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateStatus(
    id: string,
    status: 'draft' | 'sent' | 'signed' | 'cancelled',
    tenantId: string,
    token: string,
    extra: any = {},
  ) {
    const client = this.supabase.forRequest(token)
    const updates: any = { status, updated_at: new Date().toISOString(), ...extra }
    if (status === 'signed') updates.signed_at = new Date().toISOString()
    const { data, error } = await client
      .from('vendor_contracts')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('vendor_contracts')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }
}
