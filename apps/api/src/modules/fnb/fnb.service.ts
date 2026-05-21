import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class FnbService {
  constructor(private readonly supabase: SupabaseService) {}

  private db(token: string) {
    return this.supabase.getAuthenticatedClient(token)
  }

  // ── Menus ────────────────────────────────────────────────────────────────────

  async getMenus(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('fnb_menus')
      .select('*, items:fnb_menu_items(count)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getMenu(id: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('fnb_menus')
      .select('*, items:fnb_menu_items(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new NotFoundException('Menu not found')
    return data
  }

  async createMenu(eventId: string, tenantId: string, dto: any, token: string) {
    const { name, description, meal_type, sort_order } = dto
    const { data, error } = await this.db(token)
      .from('fnb_menus')
      .insert({ name, description, meal_type: meal_type ?? 'custom', sort_order: sort_order ?? 0, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateMenu(id: string, tenantId: string, dto: any, token: string) {
    const allowed = ['name', 'description', 'meal_type', 'is_active', 'sort_order']
    const patch: Record<string, any> = {}
    for (const k of allowed) if (dto[k] !== undefined) patch[k] = dto[k]
    const { data, error } = await this.db(token)
      .from('fnb_menus')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteMenu(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('fnb_menus')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
  }

  // ── Menu Items ───────────────────────────────────────────────────────────────

  async getMenuItems(menuId: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('fnb_menu_items')
      .select('*')
      .eq('menu_id', menuId)
      .eq('tenant_id', tenantId)
      .order('category')
      .order('sort_order')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createMenuItem(menuId: string, eventId: string, tenantId: string, dto: any, token: string) {
    const { name, description, category, dietary_type, allergens, estimated_quantity, unit, cost_per_unit, sort_order, notes } = dto
    const { data, error } = await this.db(token)
      .from('fnb_menu_items')
      .insert({
        name, description, category, dietary_type: dietary_type ?? 'veg',
        allergens: allergens ?? [], estimated_quantity, unit: unit ?? 'serving',
        cost_per_unit, sort_order: sort_order ?? 0, notes,
        menu_id: menuId, event_id: eventId, tenant_id: tenantId,
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateMenuItem(id: string, tenantId: string, dto: any, token: string) {
    const allowed = ['name', 'description', 'category', 'dietary_type', 'allergens',
      'estimated_quantity', 'actual_quantity', 'unit', 'cost_per_unit', 'sort_order', 'notes']
    const patch: Record<string, any> = {}
    for (const k of allowed) if (dto[k] !== undefined) patch[k] = dto[k]
    const { data, error } = await this.db(token)
      .from('fnb_menu_items')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteMenuItem(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('fnb_menu_items')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
  }

  async bulkCreateMenuItems(menuId: string, eventId: string, tenantId: string, items: any[], token: string) {
    const rows = items.map((item, i) => ({
      name: item.name, description: item.description, category: item.category,
      dietary_type: item.dietary_type ?? 'veg', allergens: item.allergens ?? [],
      estimated_quantity: item.estimated_quantity, unit: item.unit ?? 'serving',
      cost_per_unit: item.cost_per_unit, sort_order: item.sort_order ?? i, notes: item.notes,
      menu_id: menuId, event_id: eventId, tenant_id: tenantId,
    }))
    const { data, error } = await this.db(token)
      .from('fnb_menu_items')
      .insert(rows)
      .select()
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ── Token Batches ─────────────────────────────────────────────────────────────

  async getTokenBatches(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('fnb_token_batches')
      .select('*, menu:fnb_menus(id,name,meal_type)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createTokenBatch(
    eventId: string, tenantId: string, dto: any,
    createdBy: string, token: string,
  ) {
    const {
      batch_name, token_prefix = 'TKN', total_tokens, menu_id,
      valid_from, valid_until,
    } = dto

    if (!total_tokens || total_tokens < 1) {
      throw new BadRequestException('total_tokens must be >= 1')
    }

    // 1. Create the batch record
    const { data: batch, error: bErr } = await this.db(token)
      .from('fnb_token_batches')
      .insert({
        batch_name, token_prefix, total_tokens, menu_id: menu_id ?? null,
        valid_from: valid_from ?? null, valid_until: valid_until ?? null,
        event_id: eventId, tenant_id: tenantId, created_by: createdBy,
      })
      .select()
      .single()
    if (bErr) throw new BadRequestException(bErr.message)

    // 2. Generate individual tokens in chunks of 500
    const padLen = String(total_tokens).length + 2
    const CHUNK = 500
    for (let start = 1; start <= total_tokens; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, total_tokens)
      const rows = []
      for (let n = start; n <= end; n++) {
        const code = `${token_prefix}-${String(n).padStart(padLen, '0')}`
        rows.push({
          batch_id: batch.id,
          event_id: eventId,
          tenant_id: tenantId,
          token_code: code,
          qr_data: JSON.stringify({ event_id: eventId, token_code: code, batch_id: batch.id }),
          status: 'unissued',
        })
      }
      const { error: tErr } = await this.db(token)
        .from('fnb_tokens')
        .insert(rows)
      if (tErr) throw new BadRequestException(`Token insert failed: ${tErr.message}`)
    }

    return batch
  }

  async getBatchTokens(
    batchId: string, tenantId: string, token: string,
    status?: string, page = 1, limit = 50,
  ) {
    let q = this.db(token)
      .from('fnb_tokens')
      .select('*, guest:guests(id,name,phone)', { count: 'exact' })
      .eq('batch_id', batchId)
      .eq('tenant_id', tenantId)
    if (status) q = q.eq('status', status)
    const { data, error, count } = await q
      .order('token_code')
      .range((page - 1) * limit, page * limit - 1)
    if (error) throw new BadRequestException(error.message)
    return { data: data ?? [], total: count ?? 0, page, limit }
  }

  // ── Token Operations ──────────────────────────────────────────────────────────

  async issueTokenToGuest(
    batchId: string, guestId: string, tenantId: string, token: string,
  ) {
    // Find an unissued token in this batch
    const { data: tkn, error: fErr } = await this.db(token)
      .from('fnb_tokens')
      .select('id')
      .eq('batch_id', batchId)
      .eq('tenant_id', tenantId)
      .eq('status', 'unissued')
      .is('guest_id', null)
      .limit(1)
      .single()
    if (fErr || !tkn) throw new BadRequestException('No unissued tokens available in this batch')

    const now = new Date().toISOString()
    const { data, error } = await this.db(token)
      .from('fnb_tokens')
      .update({ guest_id: guestId, status: 'issued', issued_at: now })
      .eq('id', tkn.id)
      .eq('tenant_id', tenantId)
      .select('*, guest:guests(id,name,phone)')
      .single()
    if (error) throw new BadRequestException(error.message)

    // Increment issued_tokens counter on the batch (non-fatal — counter drift is acceptable)
    const { data: batch } = await this.db(token)
      .from('fnb_token_batches')
      .select('issued_tokens')
      .eq('id', batchId)
      .single()
    if (batch) {
      await this.db(token)
        .from('fnb_token_batches')
        .update({ issued_tokens: (batch.issued_tokens ?? 0) + 1 })
        .eq('id', batchId)
    }

    return data
  }

  async bulkIssueTokens(
    batchId: string, guestIds: string[], tenantId: string, token: string,
  ) {
    if (!guestIds.length) throw new BadRequestException('guestIds array is empty')

    // Fetch enough unissued tokens
    const { data: unissued, error: fErr } = await this.db(token)
      .from('fnb_tokens')
      .select('id')
      .eq('batch_id', batchId)
      .eq('tenant_id', tenantId)
      .eq('status', 'unissued')
      .is('guest_id', null)
      .order('token_code')
      .limit(guestIds.length)
    if (fErr) throw new BadRequestException(fErr.message)
    if (!unissued || unissued.length < guestIds.length) {
      throw new BadRequestException(
        `Only ${unissued?.length ?? 0} unissued tokens available, but ${guestIds.length} requested`,
      )
    }

    const now = new Date().toISOString()
    const updates = unissued.map((tkn, i) => ({
      id: tkn.id,
      guest_id: guestIds[i],
      status: 'issued' as const,
      issued_at: now,
      tenant_id: tenantId,
    }))

    // Upsert updated tokens
    const { data, error } = await this.db(token)
      .from('fnb_tokens')
      .upsert(updates, { onConflict: 'id' })
      .select('id, token_code, guest_id, status, issued_at')
    if (error) throw new BadRequestException(error.message)

    return { issued: data?.length ?? 0, tokens: data ?? [] }
  }

  async redeemToken(
    tokenCode: string, servedById: string, station: string,
    tenantId: string, token: string,
  ) {
    // Fetch the token
    const { data: tkn, error: fErr } = await this.db(token)
      .from('fnb_tokens')
      .select('*')
      .eq('token_code', tokenCode)
      .eq('tenant_id', tenantId)
      .single()
    if (fErr || !tkn) throw new NotFoundException('Token not found')

    const now = new Date()

    // Auto-expire if past valid_until
    if (tkn.status === 'issued' && tkn.valid_until && new Date(tkn.valid_until) < now) {
      await this.db(token)
        .from('fnb_tokens')
        .update({ status: 'expired' })
        .eq('id', tkn.id)
        .eq('tenant_id', tenantId)
      throw new BadRequestException('Token has expired')
    }

    if (tkn.status !== 'issued') {
      throw new BadRequestException(`Token cannot be redeemed — current status: ${tkn.status}`)
    }

    // Validate valid_from window
    if (tkn.valid_from && new Date(tkn.valid_from) > now) {
      throw new BadRequestException('Token is not yet valid')
    }

    const { data, error } = await this.db(token)
      .from('fnb_tokens')
      .update({
        status: 'redeemed',
        redeemed_at: now.toISOString(),
        redeemed_by: servedById,
        notes: station ? `Redeemed at: ${station}` : tkn.notes,
      })
      .eq('id', tkn.id)
      .eq('tenant_id', tenantId)
      .select('*, guest:guests(id,name,phone)')
      .single()
    if (error) throw new BadRequestException(error.message)

    // Increment redeemed counter (non-fatal)
    if (tkn.batch_id) {
      this.db(token)
        .from('fnb_token_batches')
        .select('tokens_redeemed')
        .eq('id', tkn.batch_id)
        .single()
        .then(({ data: batch }) => {
          if (batch) {
            return this.db(token)
              .from('fnb_token_batches')
              .update({ tokens_redeemed: (batch.tokens_redeemed ?? 0) + 1 })
              .eq('id', tkn.batch_id)
          }
        })
        .catch(() => {}) // non-fatal
    }

    return data
  }

  async voidToken(tokenId: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('fnb_tokens')
      .update({ status: 'void' })
      .eq('id', tokenId)
      .eq('tenant_id', tenantId)
      .in('status', ['unissued', 'issued']) // can't void already redeemed
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new BadRequestException('Token not found or cannot be voided')
    return data
  }

  // ── Consumption Log ──────────────────────────────────────────────────────────

  async logConsumption(
    eventId: string, tenantId: string, dto: any,
    servedById: string, token: string,
  ) {
    const { token_id, guest_id, menu_item_id, quantity, serving_station, notes } = dto
    const { data, error } = await this.db(token)
      .from('fnb_consumption_log')
      .insert({
        token_id: token_id ?? null, guest_id: guest_id ?? null,
        menu_item_id, quantity: quantity ?? 1,
        served_by: servedById, serving_station: serving_station ?? null, notes: notes ?? null,
        event_id: eventId, tenant_id: tenantId,
      })
      .select('*, item:fnb_menu_items(id,name,category,dietary_type)')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async listConsumptionLog(
    eventId: string, tenantId: string, token: string,
    filters?: { station?: string; menuItemId?: string; from?: string; to?: string },
  ) {
    let q = this.db(token)
      .from('fnb_consumption_log')
      .select('*, item:fnb_menu_items(id,name,category,dietary_type,cost_per_unit), guest:guests(id,name)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)

    if (filters?.station) q = q.eq('serving_station', filters.station)
    if (filters?.menuItemId) q = q.eq('menu_item_id', filters.menuItemId)
    if (filters?.from) q = q.gte('served_at', filters.from)
    if (filters?.to) q = q.lte('served_at', filters.to)

    const { data, error } = await q.order('served_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  // ── Serving Stations ─────────────────────────────────────────────────────────

  async getStations(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('fnb_serving_stations')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createStation(eventId: string, tenantId: string, dto: any, createdBy: string, token: string) {
    const { name, description, menu_ids } = dto
    const { data, error } = await this.db(token)
      .from('fnb_serving_stations')
      .insert({
        name, description: description ?? null,
        menu_ids: menu_ids ?? [],
        event_id: eventId, tenant_id: tenantId, created_by: createdBy,
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateStation(id: string, tenantId: string, dto: any, token: string) {
    const allowed = ['name', 'description', 'menu_ids', 'is_active']
    const patch: Record<string, any> = {}
    for (const k of allowed) if (dto[k] !== undefined) patch[k] = dto[k]
    const { data, error } = await this.db(token)
      .from('fnb_serving_stations')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteStation(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('fnb_serving_stations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
  }

  // ── Reports ───────────────────────────────────────────────────────────────────

  /** Per menu-item: total served, total cost, vs estimated */
  async getConsumptionReport(eventId: string, tenantId: string, token: string) {
    const [logData, itemData] = await Promise.all([
      this.db(token)
        .from('fnb_consumption_log')
        .select('menu_item_id, quantity, serving_station')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),
      this.db(token)
        .from('fnb_menu_items')
        .select('id, name, category, dietary_type, estimated_quantity, actual_quantity, cost_per_unit, unit')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),
    ])

    const logs = logData.data ?? []
    const items = itemData.data ?? []

    // Aggregate consumption per item
    const consumedMap: Record<string, number> = {}
    const stationMap: Record<string, Record<string, number>> = {}
    for (const log of logs) {
      consumedMap[log.menu_item_id] = (consumedMap[log.menu_item_id] ?? 0) + log.quantity
      if (log.serving_station) {
        if (!stationMap[log.serving_station]) stationMap[log.serving_station] = {}
        stationMap[log.serving_station][log.menu_item_id] =
          (stationMap[log.serving_station][log.menu_item_id] ?? 0) + log.quantity
      }
    }

    const report = items.map(item => {
      const served = consumedMap[item.id] ?? 0
      const estimated = item.estimated_quantity ?? 0
      const cost = Number(item.cost_per_unit ?? 0)
      const variance = served - estimated
      const variancePct = estimated > 0 ? Math.round((variance / estimated) * 100) : null

      return {
        item_id: item.id,
        name: item.name,
        category: item.category,
        dietary_type: item.dietary_type,
        unit: item.unit,
        estimated_quantity: estimated,
        actual_quantity: item.actual_quantity ?? null,
        total_served: served,
        variance,
        variance_pct: variancePct,
        total_cost: +(served * cost).toFixed(2),
        cost_per_unit: cost,
      }
    })

    const totals = {
      total_items: report.length,
      total_served: report.reduce((s, r) => s + r.total_served, 0),
      total_cost: +report.reduce((s, r) => s + r.total_cost, 0).toFixed(2),
    }

    return { items: report, station_breakdown: stationMap, totals }
  }

  /** Estimated vs actual quantities × cost_per_unit */
  async getBudgetSummary(eventId: string, tenantId: string, token: string) {
    const { data: items, error } = await this.db(token)
      .from('fnb_menu_items')
      .select('id, name, category, dietary_type, estimated_quantity, actual_quantity, cost_per_unit, unit, menu_id')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)

    const rows = (items ?? []).map(item => {
      const est = item.estimated_quantity ?? 0
      const act = item.actual_quantity ?? est
      const cpu = Number(item.cost_per_unit ?? 0)
      return {
        item_id: item.id,
        menu_id: item.menu_id,
        name: item.name,
        category: item.category,
        dietary_type: item.dietary_type,
        unit: item.unit,
        estimated_quantity: est,
        actual_quantity: act,
        cost_per_unit: cpu,
        estimated_cost: +(est * cpu).toFixed(2),
        actual_cost: +(act * cpu).toFixed(2),
        variance: +((act - est) * cpu).toFixed(2),
      }
    })

    const totalEstimated = +rows.reduce((s, r) => s + r.estimated_cost, 0).toFixed(2)
    const totalActual = +rows.reduce((s, r) => s + r.actual_cost, 0).toFixed(2)

    return {
      items: rows,
      totals: {
        estimated: totalEstimated,
        actual: totalActual,
        variance: +(totalActual - totalEstimated).toFixed(2),
        variance_pct: totalEstimated > 0
          ? Math.round(((totalActual - totalEstimated) / totalEstimated) * 100)
          : 0,
      },
    }
  }

  /** Dashboard: token stats + top consumed items + per-station breakdown */
  async getDashboard(eventId: string, tenantId: string, token: string) {
    const [batchData, tokenData, logData, stationData] = await Promise.all([
      this.db(token)
        .from('fnb_token_batches')
        .select('id, batch_name, total_tokens, tokens_issued, tokens_redeemed')
        .eq('event_id', eventId).eq('tenant_id', tenantId),
      this.db(token)
        .from('fnb_tokens')
        .select('status', { count: 'exact' })
        .eq('event_id', eventId).eq('tenant_id', tenantId),
      this.db(token)
        .from('fnb_consumption_log')
        .select('menu_item_id, quantity, serving_station, item:fnb_menu_items(name,category)')
        .eq('event_id', eventId).eq('tenant_id', tenantId),
      this.db(token)
        .from('fnb_serving_stations')
        .select('id, name, is_active')
        .eq('event_id', eventId).eq('tenant_id', tenantId),
    ])

    const batches = batchData.data ?? []
    const logs = logData.data ?? []
    const stations = stationData.data ?? []

    // Token stats across all batches
    const tokenStats = {
      total_tokens: batches.reduce((s, b) => s + (b.total_tokens ?? 0), 0),
      tokens_issued: batches.reduce((s, b) => s + (b.tokens_issued ?? 0), 0),
      tokens_redeemed: batches.reduce((s, b) => s + (b.tokens_redeemed ?? 0), 0),
      total_batches: batches.length,
    }
    tokenStats['tokens_unissued'] = tokenStats.total_tokens - tokenStats.tokens_issued
    tokenStats['redemption_rate'] = tokenStats.tokens_issued > 0
      ? Math.round((tokenStats.tokens_redeemed / tokenStats.tokens_issued) * 100)
      : 0

    // Top items by quantity served
    const itemTotals: Record<string, { name: string; category: string; total: number }> = {}
    for (const log of logs) {
      if (!itemTotals[log.menu_item_id]) {
        itemTotals[log.menu_item_id] = {
          name: (log as any).item?.name ?? 'Unknown',
          category: (log as any).item?.category ?? '',
          total: 0,
        }
      }
      itemTotals[log.menu_item_id].total += log.quantity
    }
    const topItems = Object.entries(itemTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id, v]) => ({ item_id: id, ...v }))

    // Per-station breakdown
    const stationBreakdown: Record<string, number> = {}
    for (const log of logs) {
      if (log.serving_station) {
        stationBreakdown[log.serving_station] = (stationBreakdown[log.serving_station] ?? 0) + log.quantity
      }
    }

    return {
      token_stats: tokenStats,
      batches,
      top_items: topItems,
      station_breakdown: stationBreakdown,
      active_stations: stations.filter(s => s.is_active).length,
      total_servings: logs.reduce((s, l) => s + l.quantity, 0),
    }
  }
}
