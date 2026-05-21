import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class FloorPlansService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByVenue(venueId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('floor_plans')
      .select(`*, floor_plan_zones(*)`)
      .eq('venue_id', venueId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findOne(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('floor_plans')
      .select(`*, floor_plan_zones(*)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { zones, ...planData } = dto
    const { data: plan, error } = await client
      .from('floor_plans')
      .insert(planData)
      .select()
      .single()
    if (error) throw new Error(error.message)

    if (zones?.length) {
      const zoneRows = zones.map((z: any) => ({
        ...z,
        floor_plan_id: plan.id,
        tenant_id: planData.tenant_id,
      }))
      const { error: zErr } = await client.from('floor_plan_zones').insert(zoneRows)
      if (zErr) throw new Error(zErr.message)
    }

    return this.findOne(plan.id, planData.tenant_id, token)
  }

  async update(id: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { zones, ...planData } = dto

    const { data, error } = await client
      .from('floor_plans')
      .update({ ...planData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    if (zones !== undefined) {
      // Replace all zones: delete old ones, insert new ones
      await client.from('floor_plan_zones').delete().eq('floor_plan_id', id)
      if (zones.length) {
        const zoneRows = zones.map((z: any) => ({
          ...z,
          floor_plan_id: id,
          tenant_id: tenantId,
        }))
        const { error: zErr } = await client.from('floor_plan_zones').insert(zoneRows)
        if (zErr) throw new Error(zErr.message)
      }
    }

    return this.findOne(id, tenantId, token)
  }

  async upsertZone(floorPlanId: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('floor_plan_zones')
      .upsert({ ...dto, floor_plan_id: floorPlanId, tenant_id: tenantId }, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteZone(zoneId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client
      .from('floor_plan_zones')
      .delete()
      .eq('id', zoneId)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  async assignToEvent(floorPlanId: string, eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('events')
      .update({ floor_plan_id: floorPlanId })
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .select('id, name, floor_plan_id')
      .single()
    if (error) throw new Error(error.message)
    return data
  }
}
