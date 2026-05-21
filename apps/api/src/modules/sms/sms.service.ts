import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { ConfigService } from '@nestjs/config'

// ─── Provider SDK type stubs (installed as optional deps) ────────────────────
type TwilioClient = {
  messages: {
    create(opts: { to: string; from: string; body: string }): Promise<{ sid: string }>
  }
}
type Msg91Client = {
  sendSMS(opts: { to: string; from: string; message: string; templateId?: string }): Promise<{ requestId: string }>
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateBroadcastDto {
  event_id?: string
  name: string
  message: string
  unicode?: boolean
  segment_filters?: Record<string, any>
  scheduled_at?: string
}

export interface SendBroadcastDto {
  broadcast_id: string
}

export interface InboundWebhookDto {
  provider: 'twilio' | 'msg91' | 'exotel'
  from_phone: string
  body: string
  provider_message_id?: string
  to_phone?: string
  status?: string          // delivery receipt: 'delivered' | 'failed' | 'undelivered'
  message_id?: string      // for delivery receipts: provider_message_id of original
  timestamp?: string
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SmsService {
  private supabase

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    )
  }

  // ── Helper: get tenant's active Supabase client (respects RLS) ─────────────
  private userClient(token: string) {
    return createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Broadcast CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  async createBroadcast(
    dto: CreateBroadcastDto,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_broadcasts')
      .insert({
        tenant_id: tenantId,
        event_id: dto.event_id ?? null,
        created_by: userId,
        name: dto.name,
        message: dto.message,
        unicode: dto.unicode ?? false,
        segment_filters: dto.segment_filters ?? {},
        scheduled_at: dto.scheduled_at ?? null,
        status: 'draft',
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getBroadcasts(tenantId: string, token: string, eventId?: string) {
    const db = this.userClient(token)
    let query = db
      .from('sms_broadcasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (eventId) query = query.eq('event_id', eventId)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getBroadcast(broadcastId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_broadcasts')
      .select('*, sms_messages(*)')
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('Broadcast not found')
    return data
  }

  async updateBroadcast(
    broadcastId: string,
    dto: Partial<CreateBroadcastDto>,
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_broadcasts')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')  // only draft can be edited
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Broadcast not found or not in draft status')
    return data
  }

  async cancelBroadcast(broadcastId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_broadcasts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'scheduled'])
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Broadcast not found or cannot be cancelled')
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Send / Queue
  // ─────────────────────────────────────────────────────────────────────────────

  async sendBroadcast(broadcastId: string, tenantId: string, token: string) {
    // 1. Load broadcast
    const { data: broadcast, error: bErr } = await this.supabase
      .from('sms_broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .eq('tenant_id', tenantId)
      .single()

    if (bErr || !broadcast) throw new NotFoundException('Broadcast not found')
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      throw new BadRequestException(`Cannot send a broadcast in status: ${broadcast.status}`)
    }

    // 2. Load provider config
    const { data: providerCfg } = await this.supabase
      .from('sms_provider_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single()

    if (!providerCfg) throw new BadRequestException('No active SMS provider configured for this tenant')

    // 3. Resolve recipient phones from segment filters
    const phones = await this.resolveSegment(tenantId, broadcast)
    if (phones.length === 0) throw new BadRequestException('No recipients matched the segment filters')

    // 4. Mark broadcast as sending, set total_recipients
    await this.supabase
      .from('sms_broadcasts')
      .update({
        status: 'sending',
        total_recipients: phones.length,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)

    // 5. Insert individual sms_messages as queued
    const messageRows = phones.map(p => ({
      broadcast_id: broadcastId,
      tenant_id: tenantId,
      guest_id: p.guest_id ?? null,
      to_phone: p.phone,
      to_name: p.name ?? null,
      status: 'queued',
    }))

    const { data: insertedMessages } = await this.supabase
      .from('sms_messages')
      .insert(messageRows)
      .select('id, to_phone, to_name, guest_id')

    // 6. Dispatch via provider (fire-and-forget per message)
    const client = await this.buildProviderClient(providerCfg)
    let sentCount = 0
    let failedCount = 0

    const dispatches = (insertedMessages ?? []).map(async (msg: any) => {
      try {
        const providerId = await this.dispatchSingle(
          client,
          providerCfg,
          msg.to_phone,
          broadcast.message,
        )
        await this.supabase
          .from('sms_messages')
          .update({
            status: 'sent',
            provider_message_id: providerId,
            sent_at: new Date().toISOString(),
          })
          .eq('id', msg.id)
        sentCount++
      } catch (err: any) {
        await this.supabase
          .from('sms_messages')
          .update({
            status: 'failed',
            error: err?.message ?? 'Unknown error',
            failed_at: new Date().toISOString(),
          })
          .eq('id', msg.id)
        failedCount++
      }
    })

    await Promise.allSettled(dispatches)

    // 7. Update broadcast counts + status
    const finalStatus = sentCount > 0 ? 'sent' : 'failed'
    await this.supabase
      .from('sms_broadcasts')
      .update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)

    return {
      broadcastId,
      totalRecipients: phones.length,
      sentCount,
      failedCount,
      status: finalStatus,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Segment resolver
  // ─────────────────────────────────────────────────────────────────────────────

  private async resolveSegment(
    tenantId: string,
    broadcast: any,
  ): Promise<{ phone: string; name?: string; guest_id?: string }[]> {
    const filters = broadcast.segment_filters ?? {}

    // Explicit phone list override
    if (filters.custom_phone_list?.length) {
      return filters.custom_phone_list.map((phone: string) => ({ phone }))
    }

    // Load opt-outs to exclude
    const { data: optouts } = await this.supabase
      .from('sms_optouts')
      .select('phone')
      .eq('tenant_id', tenantId)
    const optoutSet = new Set((optouts ?? []).map((o: any) => o.phone))

    // Base guest query
    let query = this.supabase
      .from('guests')
      .select('id, first_name, last_name, phone, rsvp_status, dietary_requirements, accommodation_type, guest_category')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null)

    if (broadcast.event_id) {
      query = query.eq('event_id', broadcast.event_id)
    }

    // Apply segment filters
    if (filters.rsvp_status?.length) {
      query = query.in('rsvp_status', filters.rsvp_status)
    }
    if (filters.accommodation_type?.length) {
      query = query.in('accommodation_type', filters.accommodation_type)
    }
    if (filters.dietary_requirement?.length) {
      query = query.overlaps('dietary_requirements', filters.dietary_requirement)
    }
    if (filters.guest_category?.length) {
      query = query.in('guest_category', filters.guest_category)
    }

    const { data: guests } = await query

    return (guests ?? [])
      .filter((g: any) => g.phone && !optoutSet.has(g.phone))
      .map((g: any) => ({
        phone: g.phone,
        name: [g.first_name, g.last_name].filter(Boolean).join(' ') || undefined,
        guest_id: g.id,
      }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider dispatch
  // ─────────────────────────────────────────────────────────────────────────────

  private async buildProviderClient(cfg: any): Promise<any> {
    const provider = cfg.provider
    if (provider === 'twilio') {
      // Dynamic import to avoid hard dependency
      try {
        const twilio = await import('twilio').then(m => m.default ?? m)
        return twilio(cfg.twilio_account_sid, cfg.twilio_auth_token)
      } catch {
        return { _provider: 'twilio', _cfg: cfg }
      }
    }
    if (provider === 'msg91') {
      return { _provider: 'msg91', _cfg: cfg }
    }
    if (provider === 'exotel') {
      return { _provider: 'exotel', _cfg: cfg }
    }
    return { _provider: provider, _cfg: cfg }
  }

  private async dispatchSingle(
    client: any,
    cfg: any,
    toPhone: string,
    message: string,
  ): Promise<string> {
    if (cfg.provider === 'twilio' && client?.messages?.create) {
      const result = await client.messages.create({
        to: toPhone,
        from: cfg.twilio_from_number,
        body: message,
      })
      return result.sid
    }

    if (cfg.provider === 'msg91') {
      // MSG91 REST API (simple HTTP call)
      const res = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: cfg.msg91_auth_key,
        },
        body: JSON.stringify({
          template_id: cfg.msg91_template_id,
          sender: cfg.msg91_sender_id,
          short_url: '0',
          mobiles: toPhone.replace('+', ''),
          VAR1: message,
        }),
      })
      const json: any = await res.json()
      if (!res.ok) throw new Error(json?.message ?? 'MSG91 send failed')
      return json.request_id ?? 'msg91_sent'
    }

    if (cfg.provider === 'exotel') {
      const formData = new URLSearchParams({
        From: cfg.exotel_from,
        To: toPhone,
        Body: message,
      })
      const res = await fetch(
        `https://api.exotel.com/v1/Accounts/${cfg.exotel_sid}/Sms/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${cfg.exotel_sid}:${cfg.exotel_token}`).toString('base64')}`,
          },
          body: formData.toString(),
        },
      )
      const json: any = await res.json()
      if (!res.ok) throw new Error(json?.RestException?.Message ?? 'Exotel send failed')
      return json?.SMSMessage?.Sid ?? 'exotel_sent'
    }

    // Stub/custom provider
    console.log(`[SMS STUB] Would send to ${toPhone}: ${message}`)
    return `stub_${Date.now()}`
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Inbound webhook (delivery receipts + replies)
  // ─────────────────────────────────────────────────────────────────────────────

  async handleInboundWebhook(tenantId: string, dto: InboundWebhookDto) {
    // Delivery receipt update
    if (dto.status && dto.message_id) {
      const statusMap: Record<string, string> = {
        delivered: 'delivered',
        failed: 'failed',
        undelivered: 'undelivered',
      }
      const mappedStatus = statusMap[dto.status] ?? dto.status

      const updatePayload: any = { status: mappedStatus }
      if (mappedStatus === 'delivered') updatePayload.delivered_at = new Date().toISOString()
      if (['failed', 'undelivered'].includes(mappedStatus)) updatePayload.failed_at = new Date().toISOString()

      const { data: msgData } = await this.supabase
        .from('sms_messages')
        .update(updatePayload)
        .eq('provider_message_id', dto.message_id)
        .eq('tenant_id', tenantId)
        .select('broadcast_id')
        .single()

      // Increment delivered/failed count on broadcast
      if (msgData?.broadcast_id) {
        const countField = mappedStatus === 'delivered' ? 'delivered_count' : 'failed_count'
        await this.supabase.rpc('increment_broadcast_count', {
          p_broadcast_id: msgData.broadcast_id,
          p_field: countField,
        })
      }
      return { received: true, type: 'receipt' }
    }

    // Inbound reply
    if (dto.from_phone && dto.body) {
      const isOptout = /\b(STOP|UNSUBSCRIBE|CANCEL|QUIT|END|UNSUB)\b/i.test(dto.body.trim())

      // Find matching guest
      const { data: guest } = await this.supabase
        .from('guests')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenantId)
        .eq('phone', dto.from_phone)
        .single()

      // Find most recent broadcast/message for this phone
      const { data: origMsg } = await this.supabase
        .from('sms_messages')
        .select('id, broadcast_id')
        .eq('tenant_id', tenantId)
        .eq('to_phone', dto.from_phone)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      await this.supabase.from('sms_replies').insert({
        tenant_id: tenantId,
        broadcast_id: origMsg?.broadcast_id ?? null,
        message_id: origMsg?.id ?? null,
        guest_id: guest?.id ?? null,
        from_phone: dto.from_phone,
        from_name: guest ? [guest.first_name, guest.last_name].filter(Boolean).join(' ') : null,
        body: dto.body,
        is_optout: isOptout,
        provider_message_id: dto.provider_message_id ?? null,
        received_at: dto.timestamp ? new Date(dto.timestamp).toISOString() : new Date().toISOString(),
      })

      // Auto opt-out
      if (isOptout) {
        await this.supabase
          .from('sms_optouts')
          .upsert(
            { tenant_id: tenantId, phone: dto.from_phone, reason: 'STOP reply', opted_out_at: new Date().toISOString() },
            { onConflict: 'tenant_id,phone', ignoreDuplicates: false },
          )

        // Update original message status
        if (origMsg?.id) {
          await this.supabase
            .from('sms_messages')
            .update({ status: 'opted_out' })
            .eq('id', origMsg.id)
        }

        // Increment broadcast optout_count
        if (origMsg?.broadcast_id) {
          await this.supabase.rpc('increment_broadcast_count', {
            p_broadcast_id: origMsg.broadcast_id,
            p_field: 'optout_count',
          })
        }
      }

      return { received: true, type: 'reply', isOptout }
    }

    return { received: true, type: 'unknown' }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Replies inbox
  // ─────────────────────────────────────────────────────────────────────────────

  async getReplies(tenantId: string, token: string, broadcastId?: string, unreadOnly = false) {
    const db = this.userClient(token)
    let query = db
      .from('sms_replies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('received_at', { ascending: false })

    if (broadcastId) query = query.eq('broadcast_id', broadcastId)
    if (unreadOnly) query = query.eq('is_read', false)

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async markReplyRead(replyId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_replies')
      .update({ is_read: true })
      .eq('id', replyId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Opt-out management
  // ─────────────────────────────────────────────────────────────────────────────

  async getOptouts(tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_optouts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('opted_out_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addOptout(phone: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_optouts')
      .upsert(
        { tenant_id: tenantId, phone, reason: 'manual', opted_out_at: new Date().toISOString() },
        { onConflict: 'tenant_id,phone', ignoreDuplicates: false },
      )
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async removeOptout(phone: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { error } = await db
      .from('sms_optouts')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('phone', phone)

    if (error) throw new BadRequestException(error.message)
    return { removed: true, phone }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider config
  // ─────────────────────────────────────────────────────────────────────────────

  async getProviderConfig(tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data } = await db
      .from('sms_provider_configs')
      .select('id, provider, is_active, twilio_from_number, msg91_sender_id, msg91_template_id, exotel_from, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .single()

    return data ?? null
  }

  async upsertProviderConfig(cfg: any, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('sms_provider_configs')
      .upsert(
        { ...cfg, tenant_id: tenantId, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id', ignoreDuplicates: false },
      )
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────────

  async getBroadcastStats(broadcastId: string, tenantId: string, token: string) {
    const db = this.userClient(token)

    const [broadcastRes, messagesRes, repliesRes] = await Promise.all([
      db.from('sms_broadcasts').select('*').eq('id', broadcastId).eq('tenant_id', tenantId).single(),
      db.from('sms_messages').select('status').eq('broadcast_id', broadcastId),
      db.from('sms_replies').select('id, is_optout, is_read').eq('broadcast_id', broadcastId),
    ])

    const broadcast = broadcastRes.data
    if (!broadcast) throw new NotFoundException('Broadcast not found')

    const messages = messagesRes.data ?? []
    const replies = repliesRes.data ?? []

    const statusCounts = messages.reduce((acc: Record<string, number>, m: any) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1
      return acc
    }, {})

    return {
      broadcast,
      statusCounts,
      deliveryRate: messages.length > 0
        ? Math.round(((statusCounts['delivered'] ?? 0) / messages.length) * 100)
        : 0,
      replyCount: replies.length,
      unreadReplies: replies.filter((r: any) => !r.is_read).length,
      optoutCount: replies.filter((r: any) => r.is_optout).length,
    }
  }
}
