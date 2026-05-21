import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import * as crypto from 'crypto'

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Inbound: Supabase DB webhook (from Edge Function)
  async handleSupabaseWebhook(payload: {
    type: 'INSERT' | 'UPDATE' | 'DELETE'
    table: string
    record: any
    old_record: any
    schema: string
  }) {
    this.logger.log(`DB webhook: ${payload.type} on ${payload.table}`)
    this.eventEmitter.emit(`db.${payload.table}.${payload.type.toLowerCase()}`, payload)
    return { processed: true }
  }

  // Outbound webhooks: tenant-configured
  async registerWebhook(dto: {
    tenantId: string
    url: string
    events: string[]
    secret?: string
    userId: string
  }, token: string) {
    const client = this.supabase.forRequest(token)
    const secret = dto.secret ?? crypto.randomBytes(32).toString('hex')
    const { data, error } = await client
      .from('webhook_endpoints')
      .insert({
        tenant_id: dto.tenantId,
        url: dto.url,
        events: dto.events,
        secret,
        created_by: dto.userId,
        is_active: true,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return { ...data, secret } // Return secret only on creation
  }

  async getWebhooks(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('webhook_endpoints')
      .select('id, url, events, is_active, created_at, last_triggered_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async toggleWebhook(id: string, active: boolean, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('webhook_endpoints')
      .update({ is_active: active })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteWebhook(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  // Dispatch outbound webhooks to registered endpoints
  async dispatch(tenantId: string, event: string, data: any) {
    const { data: endpoints } = await this.supabase.serviceClient
      .from('webhook_endpoints')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [event])

    if (!endpoints?.length) return

    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() })

    await Promise.allSettled(
      endpoints.map(async (endpoint: any) => {
        const sig = crypto
          .createHmac('sha256', endpoint.secret)
          .update(payload)
          .digest('hex')

        try {
          const res = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-OccasionPro-Signature': `sha256=${sig}`,
              'X-OccasionPro-Event': event,
            },
            body: payload,
            signal: AbortSignal.timeout(10000),
          })

          await this.supabase.serviceClient
            .from('webhook_deliveries')
            .insert({
              endpoint_id: endpoint.id,
              tenant_id: tenantId,
              event,
              status_code: res.status,
              success: res.ok,
            })

          if (res.ok) {
            await this.supabase.serviceClient
              .from('webhook_endpoints')
              .update({ last_triggered_at: new Date().toISOString() })
              .eq('id', endpoint.id)
          }
        } catch (err: any) {
          this.logger.error(`Webhook delivery failed for ${endpoint.url}: ${err.message}`)
          await this.supabase.serviceClient
            .from('webhook_deliveries')
            .insert({
              endpoint_id: endpoint.id,
              tenant_id: tenantId,
              event,
              success: false,
              error_message: err.message,
            })
        }
      }),
    )
  }
}
