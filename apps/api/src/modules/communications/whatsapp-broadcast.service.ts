import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { WhatsAppService } from './whatsapp.service'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateBroadcastDto {
  name: string
  description?: string
  message_type: 'template' | 'free_form'
  template_name?: string
  template_params?: string[]
  body_text?: string
  audience_filter?: AudienceFilter
  scheduled_at?: string
  event_id?: string
}

export interface AudienceFilter {
  all?: boolean
  rsvp_status?: string[]
  dietary?: string[]
  tags?: string[]
  guest_ids?: string[]
  phone_list?: string[]   // manual list override
}

export interface ReviewQuoteDto {
  status: 'approved' | 'rejected' | 'under_review'
  review_note?: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsAppBroadcastService {
  private readonly logger = new Logger(WhatsAppBroadcastService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async listBroadcasts(tenantId: string, eventId?: string) {
    const client = this.supabase.getClient()
    let q = client
      .from('whatsapp_broadcasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    return { broadcasts: data ?? [] }
  }

  async getBroadcast(tenantId: string, broadcastId: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('Broadcast not found')
    return data
  }

  async createBroadcast(tenantId: string, createdBy: string, dto: CreateBroadcastDto) {
    if (dto.message_type === 'template' && !dto.template_name) {
      throw new BadRequestException('template_name required for template messages')
    }
    if (dto.message_type === 'free_form' && !dto.body_text?.trim()) {
      throw new BadRequestException('body_text required for free-form messages')
    }

    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_broadcasts')
      .insert({
        tenant_id:       tenantId,
        created_by:      createdBy,
        event_id:        dto.event_id ?? null,
        name:            dto.name,
        description:     dto.description ?? null,
        message_type:    dto.message_type,
        template_name:   dto.template_name ?? null,
        template_params: dto.template_params ?? [],
        body_text:       dto.body_text ?? null,
        audience_filter: dto.audience_filter ?? { all: true },
        scheduled_at:    dto.scheduled_at ?? null,
        status:          dto.scheduled_at ? 'scheduled' : 'draft',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  async updateBroadcast(tenantId: string, broadcastId: string, dto: Partial<CreateBroadcastDto>) {
    const broadcast = await this.getBroadcast(tenantId, broadcastId)
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      throw new BadRequestException('Cannot edit a broadcast that is already sending or sent')
    }

    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_broadcasts')
      .update({
        ...dto,
        status: dto.scheduled_at ? 'scheduled' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  async deleteBroadcast(tenantId: string, broadcastId: string) {
    const broadcast = await this.getBroadcast(tenantId, broadcastId)
    if (['sending'].includes(broadcast.status)) {
      throw new BadRequestException('Cannot delete a broadcast that is currently sending')
    }

    const client = this.supabase.getClient()
    const { error } = await client
      .from('whatsapp_broadcasts')
      .delete()
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(error.message)
    return { success: true }
  }

  // ── Audience preview ──────────────────────────────────────────────────────

  /**
   * Returns the resolved list of (phone, name) recipients for a given
   * audience filter + event, minus any opted-out numbers.
   */
  async previewAudience(tenantId: string, eventId: string, filter: AudienceFilter) {
    const resolved = await this.resolveAudience(tenantId, eventId, filter)
    return {
      total: resolved.length,
      sample: resolved.slice(0, 10),
      opted_out_count: 0, // computed inside resolveAudience
    }
  }

  // ── Send / Execute ────────────────────────────────────────────────────────

  /**
   * Kick off sending for a draft/scheduled broadcast.
   * Resolves audience → creates recipient rows → fires messages in batches.
   */
  async sendBroadcast(tenantId: string, broadcastId: string) {
    const broadcast = await this.getBroadcast(tenantId, broadcastId)
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      throw new BadRequestException(`Broadcast is in ${broadcast.status} state — cannot send`)
    }

    const client = this.supabase.getClient()

    // Resolve recipients
    const audience = await this.resolveAudience(
      tenantId,
      broadcast.event_id ?? '',
      broadcast.audience_filter as AudienceFilter,
    )

    if (audience.length === 0) {
      throw new BadRequestException('No eligible recipients found for this broadcast')
    }

    // Mark as sending
    await client
      .from('whatsapp_broadcasts')
      .update({ status: 'sending', sent_at: new Date().toISOString(), total_count: audience.length })
      .eq('id', broadcastId)

    // Upsert recipient rows (pending)
    const recipientRows = audience.map(r => ({
      broadcast_id: broadcastId,
      tenant_id:    tenantId,
      guest_id:     r.guest_id ?? null,
      phone:        r.phone,
      name:         r.name,
      status:       'pending',
    }))

    const { error: insertErr } = await client
      .from('whatsapp_broadcast_recipients')
      .upsert(recipientRows, { onConflict: 'broadcast_id,phone' })

    if (insertErr) {
      this.logger.error(`Failed to insert recipients: ${insertErr.message}`)
      await client.from('whatsapp_broadcasts').update({ status: 'failed', error_message: insertErr.message }).eq('id', broadcastId)
      throw new Error(insertErr.message)
    }

    // Fire messages — batched to avoid rate limits (Meta allows ~80 msgs/min on free tier)
    setImmediate(() => this.executeSend(tenantId, broadcastId, broadcast, audience))

    return { success: true, total: audience.length, message: 'Broadcast started — messages are being sent.' }
  }

  /**
   * Background execution: send to each recipient and update delivery status.
   */
  private async executeSend(
    tenantId: string,
    broadcastId: string,
    broadcast: any,
    audience: ResolvedRecipient[],
  ) {
    const client = this.supabase.getClient()
    const BATCH_SIZE  = 20
    const BATCH_DELAY = 1000 // ms between batches (~1200 msgs/min max)
    let failed = 0

    for (let i = 0; i < audience.length; i += BATCH_SIZE) {
      const batch = audience.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (r) => {
        try {
          let result
          if (broadcast.message_type === 'template') {
            result = await this.whatsapp.sendTemplate({
              to:       r.phone,
              template: broadcast.template_name,
              params:   broadcast.template_params ?? [],
            })
          } else {
            result = await this.whatsapp.sendMessage({
              to:      r.phone,
              message: broadcast.body_text,
            })
          }

          await client
            .from('whatsapp_broadcast_recipients')
            .update({
              status:       result.success ? 'sent' : 'failed',
              wa_message_id: result.messageId ?? null,
              error_code:   result.success ? null : 'SEND_FAILED',
              error_message: result.success ? null : result.error,
              sent_at:      result.success ? new Date().toISOString() : null,
              failed_at:    result.success ? null : new Date().toISOString(),
            })
            .eq('broadcast_id', broadcastId)
            .eq('phone', r.phone)

          if (!result.success) failed++
        } catch (err: any) {
          this.logger.warn(`Failed to send to ${r.phone}: ${err.message}`)
          await client
            .from('whatsapp_broadcast_recipients')
            .update({ status: 'failed', error_message: err.message, failed_at: new Date().toISOString() })
            .eq('broadcast_id', broadcastId)
            .eq('phone', r.phone)
          failed++
        }
      }))

      // Rate-limit pause between batches (skip after last batch)
      if (i + BATCH_SIZE < audience.length) {
        await new Promise(res => setTimeout(res, BATCH_DELAY))
      }
    }

    // Mark broadcast complete
    const finalStatus = failed === audience.length ? 'failed' : 'sent'
    await client
      .from('whatsapp_broadcasts')
      .update({ status: finalStatus })
      .eq('id', broadcastId)

    this.logger.log(`Broadcast ${broadcastId} complete: ${audience.length - failed} sent, ${failed} failed`)
  }

  // ── Delivery webhook handler ──────────────────────────────────────────────

  /**
   * Called by the webhook controller when Meta Cloud API sends a
   * status update (delivered/read/failed) for a message.
   */
  async handleDeliveryWebhook(payload: MetaWebhookPayload) {
    const client = this.supabase.getClient()
    const entries = payload.entry ?? []

    for (const entry of entries) {
      for (const change of (entry.changes ?? [])) {
        const val = change.value

        // Status updates (delivered / read / failed)
        for (const status of (val.statuses ?? [])) {
          const update: Record<string, any> = { updated_at: new Date().toISOString() }

          if (status.status === 'delivered') {
            update.status       = 'delivered'
            update.delivered_at = new Date(Number(status.timestamp) * 1000).toISOString()
          } else if (status.status === 'read') {
            update.status   = 'read'
            update.read_at  = new Date(Number(status.timestamp) * 1000).toISOString()
          } else if (status.status === 'failed') {
            update.status        = 'failed'
            update.failed_at     = new Date(Number(status.timestamp) * 1000).toISOString()
            update.error_code    = status.errors?.[0]?.code?.toString()
            update.error_message = status.errors?.[0]?.title
          }

          await client
            .from('whatsapp_broadcast_recipients')
            .update(update)
            .eq('wa_message_id', status.id)
        }

        // Inbound messages — save to inbox
        for (const msg of (val.messages ?? [])) {
          const phone   = msg.from
          const contact = val.contacts?.find((c: any) => c.wa_id === phone)
          const name    = contact?.profile?.name ?? phone

          // Check if this is a reply to a broadcast
          const { data: recipient } = await client
            .from('whatsapp_broadcast_recipients')
            .select('broadcast_id, guest_id, tenant_id')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          // Auto opt-out detection
          const body = msg.text?.body ?? ''
          if (/^\s*(stop|unsubscribe|opt.?out|no more|remove me)\s*$/i.test(body)) {
            if (recipient?.tenant_id) {
              await client.from('whatsapp_opt_outs').upsert({
                tenant_id:    recipient.tenant_id,
                phone,
                source:       'user_reply',
                opted_out_at: new Date().toISOString(),
              }, { onConflict: 'tenant_id,phone' })

              await client
                .from('whatsapp_broadcast_recipients')
                .update({ status: 'opted_out' })
                .eq('phone', phone)
                .eq('broadcast_id', recipient.broadcast_id)
            }
          }

          // Save to inbox
          if (recipient?.tenant_id) {
            await client.from('whatsapp_inbox').insert({
              tenant_id:    recipient.tenant_id,
              broadcast_id: recipient.broadcast_id ?? null,
              guest_id:     recipient.guest_id ?? null,
              phone,
              contact_name: name,
              wa_message_id: msg.id,
              direction:    'inbound',
              body:         body || '[media]',
              media_url:    msg.image?.id ?? msg.document?.id ?? null,
              media_type:   msg.image ? 'image' : msg.document ? 'document' : null,
            })

            // Mark as replied
            await client
              .from('whatsapp_broadcast_recipients')
              .update({ replied_at: new Date().toISOString() })
              .eq('phone', phone)
              .eq('broadcast_id', recipient.broadcast_id)
          }
        }
      }
    }
  }

  // ── Inbox ─────────────────────────────────────────────────────────────────

  async getInbox(tenantId: string, eventId?: string, onlyUnread = false) {
    const client = this.supabase.getClient()

    // Get unique conversations (last message per phone)
    let q = client
      .from('whatsapp_inbox')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)
    if (onlyUnread) q = q.eq('is_read', false)

    const { data, error } = await q.limit(200)
    if (error) throw new Error(error.message)

    // Group by phone into thread previews
    const threads: Record<string, any> = {}
    for (const msg of data ?? []) {
      if (!threads[msg.phone]) {
        threads[msg.phone] = {
          phone:        msg.phone,
          contact_name: msg.contact_name,
          guest_id:     msg.guest_id,
          last_message: msg.body,
          last_at:      msg.created_at,
          unread_count: 0,
          direction:    msg.direction,
        }
      }
      if (!msg.is_read && msg.direction === 'inbound') {
        threads[msg.phone].unread_count++
      }
    }

    return { threads: Object.values(threads), total: Object.keys(threads).length }
  }

  async getThread(tenantId: string, phone: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_inbox')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    // Mark inbound as read
    await client
      .from('whatsapp_inbox')
      .update({ is_read: true })
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .eq('direction', 'inbound')
      .eq('is_read', false)

    return { messages: data ?? [] }
  }

  async replyToThread(tenantId: string, staffId: string, phone: string, message: string, eventId?: string) {
    // Check opt-out
    const client = this.supabase.getClient()
    const { data: optOut } = await client
      .from('whatsapp_opt_outs')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .is('opted_in_at', null)
      .single()

    if (optOut) throw new BadRequestException('This contact has opted out of WhatsApp messages')

    const result = await this.whatsapp.sendMessage({ to: phone, message })
    if (!result.success) throw new Error(`Failed to send reply: ${result.error}`)

    // Log to inbox
    const { data: inboxEntry } = await client.from('whatsapp_inbox').insert({
      tenant_id:    tenantId,
      event_id:     eventId ?? null,
      phone,
      direction:    'outbound',
      body:         message,
      wa_message_id: result.messageId ?? null,
      replied_by:   staffId,
      replied_at:   new Date().toISOString(),
      is_read:      true,
    }).select().single()

    return inboxEntry
  }

  // ── Opt-out management ────────────────────────────────────────────────────

  async listOptOuts(tenantId: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_opt_outs')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('opted_in_at', null)
      .order('opted_out_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { opt_outs: data ?? [] }
  }

  async manualOptOut(tenantId: string, phone: string, notes?: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_opt_outs')
      .upsert({ tenant_id: tenantId, phone, source: 'manual', notes: notes ?? null, opted_out_at: new Date().toISOString(), opted_in_at: null }, { onConflict: 'tenant_id,phone' })
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async reOptIn(tenantId: string, phone: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('whatsapp_opt_outs')
      .update({ opted_in_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getBroadcastAnalytics(tenantId: string, eventId?: string) {
    const client = this.supabase.getClient()
    let q = client
      .from('whatsapp_broadcasts')
      .select('id, name, status, total_count, sent_count, delivered_count, read_count, failed_count, replied_count, opted_out_count, sent_at, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'sending'])
      .order('sent_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)
    const { data, error } = await q

    if (error) throw new Error(error.message)

    const broadcasts = data ?? []
    const totals = broadcasts.reduce((acc, b) => ({
      total:     acc.total     + b.total_count,
      sent:      acc.sent      + b.sent_count,
      delivered: acc.delivered + b.delivered_count,
      read:      acc.read      + b.read_count,
      replied:   acc.replied   + b.replied_count,
      failed:    acc.failed    + b.failed_count,
    }), { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 })

    return {
      totals,
      delivery_rate:  totals.sent   > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0,
      read_rate:      totals.sent   > 0 ? Math.round((totals.read      / totals.sent) * 100) : 0,
      reply_rate:     totals.sent   > 0 ? Math.round((totals.replied   / totals.sent) * 100) : 0,
      broadcasts,
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveAudience(
    tenantId: string,
    eventId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const client = this.supabase.getClient()

    // Manual phone list override
    if (filter.phone_list?.length) {
      return filter.phone_list.map(phone => ({ phone, name: phone, guest_id: undefined }))
    }

    // Guest-based audience
    let q = client
      .from('guest_details')
      .select('id, full_name, phone, rsvp_status, dietary_requirements, tags')
      .not('phone', 'is', null)

    if (eventId) q = q.eq('event_id', eventId)
    else q = q.eq('tenant_id', tenantId)

    if (filter.rsvp_status?.length) {
      q = q.in('rsvp_status', filter.rsvp_status)
    }
    if (filter.guest_ids?.length) {
      q = q.in('id', filter.guest_ids)
    }

    const { data: guests, error } = await q
    if (error) throw new Error(error.message)

    let recipients = (guests ?? []).filter(g => !!g.phone)

    // Post-filter dietary requirements
    if (filter.dietary?.length) {
      recipients = recipients.filter(g => {
        if (!g.dietary_requirements) return false
        const gDiet = Array.isArray(g.dietary_requirements)
          ? g.dietary_requirements
          : [g.dietary_requirements]
        return filter.dietary!.some(d => gDiet.includes(d))
      })
    }

    // Remove opted-out numbers
    const { data: optOuts } = await client
      .from('whatsapp_opt_outs')
      .select('phone')
      .eq('tenant_id', tenantId)
      .is('opted_in_at', null)

    const optOutSet = new Set((optOuts ?? []).map(o => o.phone))
    recipients = recipients.filter(g => !optOutSet.has(g.phone))

    return recipients.map(g => ({
      guest_id: g.id,
      phone:    g.phone,
      name:     g.full_name,
    }))
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResolvedRecipient {
  guest_id?: string
  phone:     string
  name:      string
}

interface MetaWebhookPayload {
  object: string
  entry: {
    id: string
    changes: {
      value: {
        contacts?:  any[]
        messages?:  any[]
        statuses?:  any[]
      }
      field: string
    }[]
  }[]
}
