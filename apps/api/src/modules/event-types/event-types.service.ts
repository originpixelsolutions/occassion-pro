import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface CreateEventTypeDto {
  name: string
  icon?: string
  description?: string
  color?: string
}

export interface UpdateEventTypeDto {
  name?: string
  icon?: string
  description?: string
  color?: string
  sort_order?: number
}

export interface ReadinessItem {
  check_key: string
  check_label: string
  module: string
  is_required: boolean
  is_completed: boolean
  sort_order: number
}

export interface SmartReadinessResult {
  total_checks: number
  completed_checks: number
  score_pct: number
  event_type: string | null
  event_type_icon: string | null
  items: ReadinessItem[]
  message?: string
  error?: string
}

@Injectable()
export class EventTypesService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── List event types: system + tenant custom ──────────────────────────────

  async list(tenantId: string) {
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('event_types')
      .select('*')
      .or(`is_system.eq.true,tenant_id.eq.${tenantId}`)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return data
  }

  // ── Get single type ───────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('event_types')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new NotFoundException('Event type not found')

    // Must be system or belong to this tenant
    if (!data.is_system && data.tenant_id !== tenantId) {
      throw new ForbiddenException('Access denied')
    }
    return data
  }

  // ── Create custom event type for tenant ───────────────────────────────────

  async create(dto: CreateEventTypeDto, tenantId: string) {
    const client = this.supabase.serviceClient
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const { data, error } = await client
      .from('event_types')
      .insert({
        tenant_id:   tenantId,
        name:        dto.name,
        slug:        `${slug}-${Date.now()}`,
        icon:        dto.icon || '📅',
        description: dto.description,
        color:       dto.color || '#6366f1',
        is_system:   false,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ── Update (only tenant custom types) ────────────────────────────────────

  async update(id: string, dto: UpdateEventTypeDto, tenantId: string) {
    const type = await this.findOne(id, tenantId)
    if (type.is_system) throw new ForbiddenException('Cannot modify system event types')

    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('event_types')
      .update({
        ...(dto.name        && { name:        dto.name }),
        ...(dto.icon        && { icon:        dto.icon }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color       && { color:       dto.color }),
        ...(dto.sort_order  !== undefined && { sort_order: dto.sort_order }),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ── Delete (only tenant custom types) ─────────────────────────────────────

  async delete(id: string, tenantId: string) {
    const type = await this.findOne(id, tenantId)
    if (type.is_system) throw new ForbiddenException('Cannot delete system event types')

    const client = this.supabase.serviceClient
    const { error } = await client
      .from('event_types')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return { deleted: true }
  }

  // ── Get readiness checklist for an event type ─────────────────────────────

  async getReadinessChecklist(eventTypeId: string) {
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('event_type_readiness_checklist')
      .select('*')
      .eq('event_type_id', eventTypeId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data
  }

  // ── Compute smart readiness score for an event ────────────────────────────

  async computeSmartReadiness(eventId: string): Promise<SmartReadinessResult> {
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('event_type_readiness_checklist')
      .select('category, is_complete, is_required, weight')
      .eq('event_id', eventId)

    if (error) throw error

    const items = data ?? []
    const total = items.length
    const completed = items.filter((i: any) => i.is_complete).length
    const required = items.filter((i: any) => i.is_required)
    const requiredCompleted = required.filter((i: any) => i.is_complete).length
    const score = total > 0 ? Math.round((completed / total) * 100) : 0
    const requiredScore = required.length > 0 ? Math.round((requiredCompleted / required.length) * 100) : 100

    // Group by category
    const byCategory: Record<string, { total: number; completed: number }> = {}
    for (const item of items) {
      if (!byCategory[item.category]) byCategory[item.category] = { total: 0, completed: 0 }
      byCategory[item.category].total++
      if (item.is_complete) byCategory[item.category].completed++
    }

    return {
      score,
      required_score: requiredScore,
      total_items: total,
      completed_items: completed,
      by_category: byCategory,
    } as SmartReadinessResult
  }
}
