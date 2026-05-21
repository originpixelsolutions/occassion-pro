import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import * as crypto from 'crypto'

@Injectable()
export class IntegrationsService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(token: string) {
    return this.supabase.forRequest(token)
  }

  // ── DASHBOARD ──────────────────────────────────────────

  async getDashboard(token: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)

    const [apiKeysRes, webhooksRes, integrationsRes, deliveriesRes, logsRes] = await Promise.all([
      client.from('api_keys').select('id,name,environment,scopes,last_used_at,usage_count,is_active,created_at').eq('tenant_id', tenantId),
      client.from('webhook_endpoints').select('id,name,url,events,is_active,total_deliveries,successful_deliveries,failed_deliveries,last_triggered_at').eq('tenant_id', tenantId),
      client.from('integrations').select('id,provider,display_name,status,last_tested_at,last_synced_at').eq('tenant_id', tenantId),
      client.from('webhook_deliveries').select('id,event_type,status,response_status,response_time_ms,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
      client.from('integration_logs').select('id,provider,direction,action,status,duration_ms,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ])

    const apiKeys = apiKeysRes.data ?? []
    const webhooks = webhooksRes.data ?? []
    const integrations = integrationsRes.data ?? []
    const deliveries = deliveriesRes.data ?? []
    const logs = logsRes.data ?? []

    const totalDeliveries = webhooks.reduce((s, w) => s + (w.total_deliveries ?? 0), 0)
    const failedDeliveries = webhooks.reduce((s, w) => s + (w.failed_deliveries ?? 0), 0)
    const successRate = totalDeliveries > 0 ? Math.round(((totalDeliveries - failedDeliveries) / totalDeliveries) * 100) : 100

    return {
      overview: {
        api_keys: { total: apiKeys.length, active: apiKeys.filter(k => k.is_active).length },
        webhooks: { total: webhooks.length, active: webhooks.filter(w => w.is_active).length, success_rate: successRate },
        integrations: {
          total: integrations.length,
          connected: integrations.filter(i => i.status === 'connected').length,
          disconnected: integrations.filter(i => i.status === 'disconnected').length,
          error: integrations.filter(i => i.status === 'error').length,
        },
      },
      api_keys: apiKeys,
      webhooks,
      integrations,
      recent_deliveries: deliveries,
      recent_logs: logs,
    }
  }

  // ── API KEYS ───────────────────────────────────────────

  async listApiKeys(token: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data, error } = await client
      .from('api_keys')
      .select('id,name,key_prefix,key_last4,scopes,environment,expires_at,last_used_at,usage_count,is_active,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createApiKey(token: string, dto: {
    name: string
    scopes?: string[]
    environment?: 'live' | 'sandbox'
    expires_at?: string
  }) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)

    const env = dto.environment ?? 'live'
    const prefix = env === 'live' ? 'op_live_' : 'op_test_'
    const rawKey = prefix + crypto.randomBytes(24).toString('hex')
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyLast4 = rawKey.slice(-4)

    const { data, error } = await client.from('api_keys').insert({
      tenant_id: tenantId,
      name: dto.name,
      key_prefix: prefix,
      key_hash: keyHash,
      key_last4: keyLast4,
      scopes: dto.scopes ?? ['read'],
      environment: env,
      expires_at: dto.expires_at ?? null,
    }).select('id,name,key_prefix,key_last4,scopes,environment,expires_at,is_active,created_at').single()

    if (error) throw new BadRequestException(error.message)
    // Return full key ONCE — it is never retrievable again
    return { ...data, key: rawKey, _note: 'Store this key securely — it will not be shown again.' }
  }

  async revokeApiKey(token: string, keyId: string, reason?: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { error } = await client
      .from('api_keys')
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoke_reason: reason ?? null })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { revoked: true }
  }

  // ── WEBHOOKS ────────────────────────────────────────────

  async listWebhooks(token: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data, error } = await client
      .from('webhook_endpoints')
      .select('id,name,url,events,is_active,description,api_version,timeout_ms,retry_count,total_deliveries,successful_deliveries,failed_deliveries,last_triggered_at,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createWebhook(token: string, dto: {
    name: string
    url: string
    events: string[]
    description?: string
    timeout_ms?: number
    retry_count?: number
  }) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex')

    const { data, error } = await client.from('webhook_endpoints').insert({
      tenant_id: tenantId,
      name: dto.name,
      url: dto.url,
      secret,
      events: dto.events,
      description: dto.description,
      timeout_ms: dto.timeout_ms ?? 10000,
      retry_count: dto.retry_count ?? 3,
    }).select('id,name,url,events,is_active,description,timeout_ms,retry_count,created_at').single()

    if (error) throw new BadRequestException(error.message)
    return { ...data, secret, _note: 'Store the signing secret securely — it will not be shown again.' }
  }

  async updateWebhook(token: string, webhookId: string, dto: Partial<{
    name: string
    url: string
    events: string[]
    is_active: boolean
    description: string
    timeout_ms: number
    retry_count: number
  }>) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data, error } = await client
      .from('webhook_endpoints')
      .update(dto)
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
      .select('id,name,url,events,is_active').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteWebhook(token: string, webhookId: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { error } = await client
      .from('webhook_endpoints')
      .delete()
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  async rotateWebhookSecret(token: string, webhookId: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const newSecret = 'whsec_' + crypto.randomBytes(24).toString('hex')
    const { error } = await client
      .from('webhook_endpoints')
      .update({ secret: newSecret })
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { secret: newSecret, _note: 'Update this secret in your endpoint immediately.' }
  }

  async testWebhook(token: string, webhookId: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data: webhook } = await client
      .from('webhook_endpoints')
      .select('url,secret')
      .eq('id', webhookId)
      .eq('tenant_id', tenantId)
      .single()
    if (!webhook) throw new NotFoundException('Webhook not found')

    const payload = {
      id: crypto.randomUUID(),
      type: 'webhook.test',
      created: new Date().toISOString(),
      data: { message: 'This is a test delivery from OccasionPro.' },
    }
    const body = JSON.stringify(payload)
    const sig = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')

    const start = Date.now()
    let status = 'success', responseStatus = 200, errorMsg: string | null = null
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OccasionPro-Signature': `sha256=${sig}`,
          'X-OccasionPro-Event': 'webhook.test',
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      responseStatus = res.status
      if (!res.ok) { status = 'failed'; errorMsg = `HTTP ${res.status}` }
    } catch (e) {
      status = 'failed'
      responseStatus = 0
      errorMsg = e instanceof Error ? e.message : 'Unknown error'
    }
    const duration = Date.now() - start

    await client.from('webhook_deliveries').insert({
      tenant_id: tenantId,
      endpoint_id: webhookId,
      event_type: 'webhook.test',
      payload,
      status,
      response_status: responseStatus,
      response_time_ms: duration,
      error_message: errorMsg,
      delivered_at: status === 'success' ? new Date().toISOString() : null,
    })

    return { status, response_status: responseStatus, duration_ms: duration, error: errorMsg }
  }

  async getWebhookDeliveries(token: string, webhookId: string, page = 1, limit = 20) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const from = (page - 1) * limit
    const { data, count, error } = await client
      .from('webhook_deliveries')
      .select('*', { count: 'exact' })
      .eq('endpoint_id', webhookId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)
    if (error) throw new BadRequestException(error.message)
    return { data, total: count, page, limit }
  }

  async retryDelivery(token: string, deliveryId: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data: delivery } = await client
      .from('webhook_deliveries')
      .select('*, webhook_endpoints(url,secret)')
      .eq('id', deliveryId)
      .eq('tenant_id', tenantId)
      .single()
    if (!delivery) throw new NotFoundException('Delivery not found')

    const body = JSON.stringify(delivery.payload)
    const sig = crypto.createHmac('sha256', (delivery.webhook_endpoints as any).secret).update(body).digest('hex')

    const start = Date.now()
    let status = 'success', responseStatus = 200, errorMsg: string | null = null
    try {
      const res = await fetch((delivery.webhook_endpoints as any).url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OccasionPro-Signature': `sha256=${sig}`,
          'X-OccasionPro-Event': delivery.event_type,
          'X-OccasionPro-Retry': String(delivery.attempt + 1),
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      responseStatus = res.status
      if (!res.ok) { status = 'failed'; errorMsg = `HTTP ${res.status}` }
    } catch (e) {
      status = 'failed'; errorMsg = e instanceof Error ? e.message : 'Unknown error'
    }

    const { data: updated } = await client
      .from('webhook_deliveries')
      .update({ status, response_status: responseStatus, response_time_ms: Date.now() - start, error_message: errorMsg, attempt: delivery.attempt + 1, delivered_at: status === 'success' ? new Date().toISOString() : null })
      .eq('id', deliveryId)
      .select('id,status,attempt').single()

    return updated
  }

  // ── INTEGRATIONS ────────────────────────────────────────

  async listIntegrations(token: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)

    // Seed slots if not present
    await client.rpc('seed_integration_slots', { p_tenant_id: tenantId })

    const { data, error } = await client
      .from('integrations')
      .select('id,provider,display_name,status,metadata,last_tested_at,last_error,last_synced_at,connected_at,created_at')
      .eq('tenant_id', tenantId)
      .order('provider')
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async connectIntegration(token: string, provider: string, dto: {
    config?: Record<string, unknown>
    secrets?: Record<string, unknown>
  }) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data, error } = await client
      .from('integrations')
      .update({
        status: 'connected',
        config: dto.config ?? {},
        secrets: dto.secrets ?? {},
        connected_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .select('id,provider,display_name,status,connected_at').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async disconnectIntegration(token: string, provider: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const { data, error } = await client
      .from('integrations')
      .update({ status: 'disconnected', config: {}, secrets: {}, connected_at: null })
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .select('id,provider,status').single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async testIntegration(token: string, provider: string) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    // Simulate connection test (in production, call provider's ping endpoint)
    const { data: integration } = await client
      .from('integrations')
      .select('status,config')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .single()
    if (!integration) throw new NotFoundException('Integration not found')
    if (integration.status !== 'connected') throw new BadRequestException('Integration is not connected')

    const testResult = { success: true, latency_ms: Math.floor(Math.random() * 150) + 50 }

    await client.from('integrations').update({ last_tested_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('provider', provider)

    await client.from('integration_logs').insert({
      tenant_id: tenantId,
      provider,
      direction: 'outbound',
      action: 'connection_test',
      status: 'success',
      response: testResult,
      duration_ms: testResult.latency_ms,
    })

    return testResult
  }

  async getIntegrationLogs(token: string, provider?: string, page = 1, limit = 50) {
    const client = this.client(token)
    const tenantId = await this.getTenantId(client)
    const from = (page - 1) * limit
    let query = client
      .from('integration_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)
    if (provider) query = query.eq('provider', provider)
    const { data, count, error } = await query
    if (error) throw new BadRequestException(error.message)
    return { data, total: count, page, limit }
  }

  // ── WEBHOOK EVENT TYPES ────────────────────────────────

  getEventTypes() {
    return {
      events: [
        { type: 'event.created', description: 'A new event is created', category: 'Events' },
        { type: 'event.updated', description: 'An event is updated', category: 'Events' },
        { type: 'event.cancelled', description: 'An event is cancelled', category: 'Events' },
        { type: 'event.completed', description: 'An event is marked complete', category: 'Events' },
      ],
      tickets: [
        { type: 'ticket.created', description: 'A support ticket is raised', category: 'Support' },
        { type: 'ticket.status_changed', description: 'Ticket status changes', category: 'Support' },
        { type: 'ticket.escalated', description: 'Ticket is escalated', category: 'Support' },
        { type: 'ticket.resolved', description: 'Ticket is resolved', category: 'Support' },
      ],
      payments: [
        { type: 'payment.received', description: 'A payment is received', category: 'Finance' },
        { type: 'payment.failed', description: 'A payment fails', category: 'Finance' },
        { type: 'payment.refunded', description: 'A payment is refunded', category: 'Finance' },
        { type: 'invoice.overdue', description: 'An invoice becomes overdue', category: 'Finance' },
      ],
      operations: [
        { type: 'guest.checked_in', description: 'A guest checks in', category: 'Operations' },
        { type: 'vendor.confirmed', description: 'A vendor confirms booking', category: 'Operations' },
        { type: 'vendor.declined', description: 'A vendor declines booking', category: 'Operations' },
        { type: 'staff.assigned', description: 'Staff assigned to an event', category: 'Operations' },
        { type: 'staff.checkin', description: 'Staff checks in on-site', category: 'Operations' },
        { type: 'task.completed', description: 'A task is completed', category: 'Operations' },
        { type: 'report.generated', description: 'A report is generated', category: 'Operations' },
      ],
    }
  }

  // ── HELPERS ────────────────────────────────────────────

  private async getTenantId(client: ReturnType<SupabaseService['forRequest']>) {
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new BadRequestException('Unauthenticated')
    const { data } = await client.from('profiles').select('tenant_id').eq('id', user.id).single()
    return data?.tenant_id as string
  }
}
