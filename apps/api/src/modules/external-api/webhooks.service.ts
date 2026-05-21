import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { WebhookSecurityService } from '../../common/security/webhook-security.service'
import * as crypto from 'crypto'

export interface CreateWebhookDto {
  name: string
  url: string
  events: string[]
  ssl_verify?: boolean
  timeout_seconds?: number
  retry_count?: number
}

export const WEBHOOK_EVENTS = [
  'event.created', 'event.updated', 'event.deleted', 'event.published',
  'guest.created', 'guest.updated', 'guest.rsvp_changed', 'guest.deleted',
  'vendor.assigned', 'vendor.updated', 'vendor.removed',
  'invoice.created', 'invoice.paid', 'invoice.overdue',
  'task.completed', 'task.overdue',
  'team.member_added', 'team.member_removed',
  'incident.reported', 'incident.resolved',
  'api_key.approved', 'api_key.revoked',
]

@Injectable()
export class WebhooksService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly webhookSecurity: WebhookSecurityService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateWebhookDto) {
    // Validate URL
    try { new URL(dto.url) } catch { throw new BadRequestException('Invalid URL') }
    if (!dto.url.startsWith('https://')) {
      throw new BadRequestException('Webhook URL must use HTTPS')
    }

    // Validate events
    const invalid = dto.events.filter(e => !WEBHOOK_EVENTS.includes(e))
    if (invalid.length) throw new BadRequestException(`Unknown events: ${invalid.join(', ')}`)

    // Generate signing secret
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex')

    const { data, error } = await this.supabase.serviceClient
      .from('api_webhooks')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        url: dto.url,
        secret: secretHash,
        events: dto.events,
        ssl_verify: dto.ssl_verify ?? true,
        timeout_seconds: dto.timeout_seconds ?? 10,
        retry_count: dto.retry_count ?? 3,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Return secret ONCE
    return { ...data, signing_secret: secret }
  }

  async list(tenantId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('api_webhooks')
      .select('id,name,url,events,status,ssl_verify,timeout_seconds,retry_count,last_triggered_at,last_success_at,last_failure_at,failure_count,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async update(tenantId: string, webhookId: string, dto: Partial<CreateWebhookDto> & { status?: string }) {
    await this.getWebhook(tenantId, webhookId)

    if (dto.url) {
      try { new URL(dto.url) } catch { throw new BadRequestException('Invalid URL') }
      if (!dto.url.startsWith('https://')) throw new BadRequestException('Webhook URL must use HTTPS')
    }

    const { data, error } = await this.supabase.serviceClient
      .from('api_webhooks')
      .update(dto)
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async delete(tenantId: string, webhookId: string) {
    await this.getWebhook(tenantId, webhookId)
    await this.supabase.serviceClient
      .from('api_webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
    return { deleted: true }
  }

  async getDeliveries(tenantId: string, webhookId: string, limit = 50) {
    await this.getWebhook(tenantId, webhookId)

    const { data, error } = await this.supabase.serviceClient
      .from('webhook_deliveries')
      .select('id,event_type,status,response_code,response_ms,error_message,attempt,delivered_at')
      .eq('webhook_id', webhookId)
      .order('delivered_at', { ascending: false })
      .limit(limit)

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // Called by WebhookDispatchService to re-deliver a failed delivery
  async retryDelivery(tenantId: string, deliveryId: string) {
    const { data: delivery } = await this.supabase.serviceClient
      .from('webhook_deliveries')
      .select('*, webhook:api_webhooks(*)')
      .eq('id', deliveryId)
      .eq('tenant_id', tenantId)
      .single()

    if (!delivery) throw new NotFoundException('Delivery not found')
    if (delivery.status === 'success') throw new BadRequestException('Delivery already succeeded')

    await this.dispatch(delivery.webhook, delivery.event_type, delivery.payload, delivery.attempt + 1)
    return { retried: true }
  }

  // ─── Core dispatch logic ────────────────────────────────────────────────
  async dispatch(webhook: any, eventType: string, payload: object, attempt = 1) {
    if (webhook.status !== 'active') return

    const deliveryId = crypto.randomUUID()
    // SECURITY: Use Unix seconds (not ms) for timestamp — allows receiver to do ±5min window check
    const timestampSeconds = Math.floor(Date.now() / 1000).toString()

    const body = JSON.stringify({
      id: deliveryId,
      type: eventType,
      created_at: new Date().toISOString(),
      data: payload,
    })

    // SECURITY: Sign both timestamp + body so receivers can verify freshness without trusting
    // the timestamp header alone. Format mirrors Stripe webhook signature convention.
    // signed_content = `{timestamp}.{body}` — prevents timestamp stripping attacks.
    const signedContent = `${timestampSeconds}.${body}`
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(signedContent)
      .digest('hex')

    const start = Date.now()
    let responseCode: number | null = null
    let responseBody: string | null = null
    let errorMessage: string | null = null
    let status: 'success' | 'failed' = 'success'

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000)

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Signature format: `t={timestamp},sha256={hmac}` — matches Stripe convention
          // Receiver should verify: HMAC-SHA256(secret, `{t}.{body}`) == sha256 value
          'X-OccasionPro-Signature': `t=${timestampSeconds},sha256=${signature}`,
          'X-OccasionPro-Event': eventType,
          'X-OccasionPro-Delivery': deliveryId,
          // SECURITY: Timestamp header — receivers use this to reject stale deliveries (±5min)
          'X-Webhook-Timestamp': timestampSeconds,
          'User-Agent': 'OccasionPro-Webhooks/1.0',
        },
        body,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      responseCode = res.status
      responseBody = await res.text().catch(() => null)
      if (!res.ok) {
        status = 'failed'
        errorMessage = `HTTP ${res.status}`
      }
    } catch (err: any) {
      status = 'failed'
      errorMessage = err.message ?? 'Network error'
    }

    const responseMs = Date.now() - start

    // Log delivery
    const nextRetry = status === 'failed' && attempt < webhook.retry_count
      ? new Date(Date.now() + attempt * 30_000).toISOString()
      : null

    await this.supabase.getServiceClient()
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        tenant_id: webhook.tenant_id,
        event_type: eventType,
        payload,
        attempt,
        status,
        response_code: responseCode,
        response_body: responseBody?.slice(0, 500),
        response_ms: responseMs,
        error_message: errorMessage,
        next_retry_at: nextRetry,
      })

    // Update webhook stats
    const statsUpdate: Record<string, any> = {
      last_triggered_at: new Date().toISOString(),
    }
    if (status === 'success') {
      statsUpdate.last_success_at = new Date().toISOString()
      statsUpdate.failure_count = 0
    } else {
      statsUpdate.last_failure_at = new Date().toISOString()
      statsUpdate.failure_count = (webhook.failure_count ?? 0) + 1
      // Auto-disable after 10 consecutive failures
      if (statsUpdate.failure_count >= 10) statsUpdate.status = 'disabled'
    }

    await this.supabase.getServiceClient()
      .from('api_webhooks')
      .update(statsUpdate)
      .eq('id', webhook.id)
  }

  // ─── Fan-out: dispatch to all webhooks subscribed to an event ───────────
  async fanOut(tenantId: string, eventType: string, payload: object) {
    const { data: webhooks } = await this.supabase.getServiceClient()
      .from('api_webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .contains('events', [eventType])

    if (!webhooks?.length) return

    await Promise.allSettled(
      webhooks.map(wh => this.dispatch(wh, eventType, payload))
    )
  }

  async getAvailableEvents() {
    return WEBHOOK_EVENTS
  }

  private async getWebhook(tenantId: string, webhookId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('api_webhooks')
      .select('*')
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
      .single()
    if (error || !data) throw new NotFoundException('Webhook not found')
    return data
  }
}
