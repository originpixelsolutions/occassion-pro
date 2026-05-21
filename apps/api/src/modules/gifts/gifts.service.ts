import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class GiftsService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return this.supabase.serviceClient }

  // ─── Registry ────────────────────────────────────────────────────────────
  async getOrCreateRegistry(eventId: string, tenantId: string) {
    const { data: existing } = await this.db
      .from('gift_registries')
      .select('*, items:gift_items(count)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (existing) return existing

    const { data, error } = await this.db
      .from('gift_registries')
      .insert({ event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateRegistry(eventId: string, tenantId: string, dto: any) {
    const registry = await this.getOrCreateRegistry(eventId, tenantId)

    const { data, error } = await this.db
      .from('gift_registries')
      .update(dto)
      .eq('id', registry.id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Registry Items ───────────────────────────────────────────────────────
  async listItems(eventId: string, tenantId: string) {
    const registry = await this.getOrCreateRegistry(eventId, tenantId)

    const { data, error } = await this.db
      .from('gift_items')
      .select('*')
      .eq('registry_id', registry.id)
      .order('priority', { ascending: false })
      .order('sort_order')

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addItem(eventId: string, tenantId: string, dto: any) {
    const registry = await this.getOrCreateRegistry(eventId, tenantId)

    const { data, error } = await this.db
      .from('gift_items')
      .insert({ ...dto, registry_id: registry.id, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateItem(tenantId: string, itemId: string, dto: any) {
    const { data, error } = await this.db
      .from('gift_items')
      .update(dto)
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteItem(tenantId: string, itemId: string) {
    await this.db.from('gift_items').delete().eq('id', itemId).eq('tenant_id', tenantId)
    return { deleted: true }
  }

  // ─── Gifts Received ───────────────────────────────────────────────────────
  async listReceived(eventId: string, tenantId: string, filters: any = {}) {
    let q = this.db
      .from('gifts_received')
      .select(`
        *,
        guest:guests(id, name, phone, email)
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('received_date', { ascending: false })

    if (filters.gift_type) q = q.eq('gift_type', filters.gift_type)
    if (filters.thank_you_sent !== undefined) q = q.eq('thank_you_sent', filters.thank_you_sent === 'true')
    if (filters.category) q = q.eq('category', filters.category)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async logGift(eventId: string, tenantId: string, userId: string, dto: any) {
    const { data, error } = await this.db
      .from('gifts_received')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId, created_by: userId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // If tied to a registry item, increment quantity_received
    if (dto.gift_item_id) {
      // Inline increment — no generic RPC needed
      this.db
        .from('gift_items')
        .select('quantity_received')
        .eq('id', dto.gift_item_id)
        .single()
        .then(({ data: item }) => {
          if (item) {
            return this.db
              .from('gift_items')
              .update({ quantity_received: (item.quantity_received ?? 0) + (dto.quantity ?? 1) })
              .eq('id', dto.gift_item_id)
          }
        })
        .catch(() => {}) // non-fatal
    }

    return data
  }

  async updateGift(tenantId: string, giftId: string, dto: any) {
    const { data, error } = await this.db
      .from('gifts_received')
      .update(dto)
      .eq('id', giftId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteGift(tenantId: string, giftId: string) {
    await this.db.from('gifts_received').delete().eq('id', giftId).eq('tenant_id', tenantId)
    return { deleted: true }
  }

  // ─── Mark thank-you sent ──────────────────────────────────────────────────
  async markThankYou(tenantId: string, giftIds: string[], channel: string) {
    const { data, error } = await this.db
      .from('gifts_received')
      .update({
        thank_you_sent: true,
        thank_you_sent_at: new Date().toISOString(),
        thank_you_channel: channel,
      })
      .in('id', giftIds)
      .eq('tenant_id', tenantId)
      .select()

    if (error) throw new BadRequestException(error.message)
    return { updated: data?.length ?? 0 }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  async getSummary(eventId: string, tenantId: string) {
    const { data, error } = await this.db
      .from('v_gift_summary')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      // View returns no row if no gifts — return zeroed summary
      return {
        event_id: eventId, tenant_id: tenantId,
        total_gifts: 0, cash_gifts: 0, physical_gifts: 0,
        total_estimated_value: 0, total_cash_received: 0,
        pending_thankyou: 0, thankyou_sent: 0,
      }
    }
    return data
  }

  // ─── Thank-you templates ───────────────────────────────────────────────────
  async getTemplates(tenantId: string, eventId?: string) {
    let q = this.db
      .from('gift_thankyou_templates')
      .select('*')
      .eq('tenant_id', tenantId)
    if (eventId) q = q.or(`event_id.eq.${eventId},event_id.is.null`)
    else q = q.is('event_id', null)

    const { data } = await q.order('is_default', { ascending: false })
    return data ?? []
  }

  // ─── Generate thank-you message ────────────────────────────────────────────
  generateMessage(template: string, gift: any): string {
    return template
      .replace(/\{\{giver_name\}\}/g, gift.giver_name ?? 'Friend')
      .replace(/\{\{gift_name\}\}/g, gift.name)
      .replace(/\{\{event_name\}\}/g, gift.event_name ?? 'our event')
      .replace(/\{\{gift_value\}\}/g, gift.estimated_value ? `₹${gift.estimated_value}` : 'your thoughtful gift')
  }
}
