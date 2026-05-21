import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class DecorService {
  constructor(private readonly supabase: SupabaseService) {}

  private ctx(token: string) {
    return this.supabase.forRequest(token)
  }

  // ── Zones ──────────────────────────────────────────────────────────────────

  async listZones(eventId: string, tenantId: string, token: string) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('decor_zones')
      .select('*, items:decor_items(id,status,unit_cost,quantity)')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data
  }

  async createZone(tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('decor_zones')
      .insert({ ...body, tenant_id: tenantId })
      .select().single()
    if (error) throw error
    return data
  }

  async updateZone(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('decor_zones')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async deleteZone(id: string, tenantId: string, token: string) {
    const db = this.ctx(token)
    const { error } = await db.from('decor_zones').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  async listItems(eventId: string, tenantId: string, token: string, opts?: { zone_id?: string; category?: string; status?: string }) {
    const db = this.ctx(token)
    let q = db
      .from('decor_items')
      .select('*, zone:decor_zones(id,zone_name), vendor:vendors(id,name)')
      .eq('event_id', eventId)
      .order('item_category', { ascending: true })
    if (opts?.zone_id) q = q.eq('zone_id', opts.zone_id)
    if (opts?.category) q = q.eq('item_category', opts.category)
    if (opts?.status) q = q.eq('status', opts.status)
    const { data, error } = await q
    if (error) throw error
    return data
  }

  async createItem(tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('decor_items')
      .insert({ ...body, tenant_id: tenantId })
      .select().single()
    if (error) throw error
    return data
  }

  async updateItem(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('decor_items')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async deleteItem(id: string, tenantId: string, token: string) {
    const db = this.ctx(token)
    const { error } = await db.from('decor_items').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }

  // ── Stats (Smart) ─────────────────────────────────────────────────────────

  async getStats(eventId: string, tenantId: string, token: string) {
    const db = this.ctx(token)
    const [{ data: zones }, { data: items }] = await Promise.all([
      db.from('decor_zones').select('id,budget,actual_cost,status').eq('event_id', eventId),
      db.from('decor_items').select('id,status,unit_cost,quantity,delivery_date').eq('event_id', eventId),
    ])

    const totalZones = zones?.length ?? 0
    const totalItems = items?.length ?? 0
    const confirmedItems = items?.filter(i => ['confirmed', 'delivered', 'installed'].includes(i.status)).length ?? 0
    const pendingItems = items?.filter(i => i.status === 'pending').length ?? 0
    const cancelledItems = items?.filter(i => i.status === 'cancelled').length ?? 0

    const totalBudget = zones?.reduce((s, z) => s + (z.budget ?? 0), 0) ?? 0
    const totalActual = zones?.reduce((s, z) => s + (z.actual_cost ?? 0), 0) ?? 0
    const totalItemCost = items?.reduce((s, i) => s + ((i.unit_cost ?? 0) * (i.quantity ?? 1)), 0) ?? 0

    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 86400000)
    const upcomingDeliveries = items?.filter(i => {
      if (!i.delivery_date) return false
      const d = new Date(i.delivery_date)
      return d >= now && d <= in7Days && i.status === 'ordered'
    }).length ?? 0

    const alerts: Array<{ severity: string; message: string }> = []
    if (totalBudget > 0 && totalItemCost > totalBudget * 1.1) {
      alerts.push({ severity: 'high', message: `Décor cost (${Math.round((totalItemCost / totalBudget) * 100)}% of budget) is exceeding the zone budgets` })
    }
    if (pendingItems > 0) {
      alerts.push({ severity: 'medium', message: `${pendingItems} décor item${pendingItems > 1 ? 's' : ''} still unconfirmed` })
    }
    if (upcomingDeliveries > 0) {
      alerts.push({ severity: 'low', message: `${upcomingDeliveries} item${upcomingDeliveries > 1 ? 's' : ''} scheduled for delivery in the next 7 days` })
    }

    return { total_zones: totalZones, total_items: totalItems, confirmed_items: confirmedItems, pending_items: pendingItems, cancelled_items: cancelledItems, total_budget: totalBudget, total_actual: totalActual, total_item_cost: totalItemCost, upcoming_deliveries: upcomingDeliveries, alerts }
  }
}
