import {
  Injectable, BadRequestException, ConflictException, NotFoundException,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../common/supabase/supabase.service'
import * as dns from 'dns'

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

// ─── Cloudflare API helpers ────────────────────────────────────────────────────

interface CfCustomHostname {
  id:     string
  status: 'pending' | 'active' | 'moved' | 'deleted' | 'blocked' | string
  ssl?: { status: string }
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CustomDomainsService {
  private readonly cfZoneId:   string
  private readonly cfApiToken: string
  private readonly appOrigin:  string   // e.g. https://app.occasionpro.in
  private readonly kvApiUrl:   string   // Cloudflare Workers KV REST endpoint base

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config:   ConfigService,
  ) {
    this.cfZoneId   = config.get<string>('CF_ZONE_ID', '')
    this.cfApiToken = config.get<string>('CF_API_TOKEN', '')
    this.appOrigin  = config.get<string>('APP_ORIGIN', 'https://app.occasionpro.in')
    this.kvApiUrl   = config.get<string>('CF_KV_API_URL', '') // set to Cloudflare KV write endpoint
  }

  // ── CF request helper ────────────────────────────────────────────────────────

  private async cfRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<T> {
    const url = `https://api.cloudflare.com/client/v4${path}`
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.cfApiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json() as any
    if (!data.success) {
      const msg = data.errors?.[0]?.message ?? 'Cloudflare API error'
      throw new Error(msg)
    }
    return data.result as T
  }

  // ── KV helpers ───────────────────────────────────────────────────────────────

  private async kvWrite(domain: string, tenantSlug: string): Promise<void> {
    if (!this.cfZoneId || !this.cfApiToken) return
    const accountId = this.config.get<string>('CF_ACCOUNT_ID', '')
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID', '')
    if (!accountId || !namespaceId) return

    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(domain)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.cfApiToken}`,
          'Content-Type': 'text/plain',
        },
        body: tenantSlug,
      },
    )
  }

  private async kvDelete(domain: string): Promise<void> {
    const accountId   = this.config.get<string>('CF_ACCOUNT_ID', '')
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID', '')
    if (!accountId || !namespaceId || !this.cfApiToken) return

    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(domain)}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.cfApiToken}` },
      },
    )
  }

  // ── Tenant slug helper ───────────────────────────────────────────────────────

  private async getTenantSlug(tenantId: string): Promise<string> {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb.from('tenants').select('slug').eq('id', tenantId).single()
    return data?.slug ?? tenantId
  }

  // ── Public methods ───────────────────────────────────────────────────────────

  async addDomain(tenantId: string, domain: string) {
    const normalised = domain.toLowerCase().trim()
    if (!DOMAIN_RE.test(normalised)) {
      throw new BadRequestException('Invalid domain format')
    }
    if (normalised.endsWith('.occasionpro.in')) {
      throw new BadRequestException('Cannot use an OccasionPro subdomain as a custom domain')
    }

    const sb = this.supabase.getAdminClient()

    // Check already taken
    const { data: existing } = await sb
      .from('tenant_custom_domains')
      .select('id, tenant_id')
      .eq('domain', normalised)
      .maybeSingle()

    if (existing) {
      if (existing.tenant_id === tenantId) throw new ConflictException('You have already added this domain')
      throw new ConflictException('Domain is already in use')
    }

    // Remove any existing entry for this tenant (one-domain-per-tenant rule)
    await sb.from('tenant_custom_domains').delete().eq('tenant_id', tenantId)

    const token = crypto.randomUUID()
    const parts = normalised.split('.')
    const subdomainPrefix = parts.length > 2 ? parts[0] : null

    const { data, error } = await sb
      .from('tenant_custom_domains')
      .insert({
        tenant_id:          tenantId,
        domain:             normalised,
        subdomain_prefix:   subdomainPrefix,
        verification_token: token,
        verification_method:'txt_record',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return {
      ...data,
      dns_instructions: this.buildDnsInstructions(normalised, token),
    }
  }

  async getDomainStatus(tenantId: string) {
    const sb = this.supabase.getAdminClient()
    const { data } = await sb
      .from('tenant_custom_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!data) return null

    return {
      ...data,
      dns_instructions: this.buildDnsInstructions(data.domain, data.verification_token),
    }
  }

  async verifyDomain(tenantId: string) {
    const sb = this.supabase.getAdminClient()
    const { data: row } = await sb
      .from('tenant_custom_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!row) throw new NotFoundException('No custom domain configured')
    if (row.is_verified) return { verified: true, message: 'Already verified' }

    const verified = await this.checkDnsRecord(row.domain, row.verification_token)

    await sb.from('tenant_custom_domains').update({
      last_checked_at: new Date().toISOString(),
      check_failures:  verified ? 0 : row.check_failures + 1,
      ...(verified ? { is_verified: true, verified_at: new Date().toISOString() } : {}),
    }).eq('id', row.id)

    if (verified) {
      // Fire-and-forget SSL provisioning
      this.triggerSslProvisioning(tenantId, row.domain).catch(console.error)
    }

    return {
      verified,
      check_failures: verified ? 0 : row.check_failures + 1,
      message: verified ? 'Domain verified successfully' : 'DNS record not found yet — please allow up to 24h for propagation',
    }
  }

  async checkDnsRecord(domain: string, token: string): Promise<boolean> {
    try {
      // TXT record check: _occasionpro-verify.{domain}
      const verifyHost = `_occasionpro-verify.${domain}`
      const records = await dns.promises.resolveTxt(verifyHost)
      const flat = records.flat()
      if (flat.some(r => r.includes(`op-verify=${token}`))) return true
    } catch {
      // TXT lookup failed, try CNAME fallback
    }

    try {
      const records = await dns.promises.resolveCname(domain)
      if (records.some(r => r.includes('cname.occasionpro.in'))) return true
    } catch {
      // CNAME not found either
    }

    return false
  }

  async triggerSslProvisioning(tenantId: string, domain: string): Promise<void> {
    const sb = this.supabase.getAdminClient()

    if (!this.cfZoneId || !this.cfApiToken) {
      // Dev mode: skip Cloudflare, mark as active immediately
      await sb.from('tenant_custom_domains').update({
        ssl_status:         'active',
        ssl_provisioned_at: new Date().toISOString(),
        is_active:          true,
      }).eq('tenant_id', tenantId)

      const slug = await this.getTenantSlug(tenantId)
      await this.kvWrite(domain, slug).catch(() => {})
      return
    }

    await sb.from('tenant_custom_domains').update({ ssl_status: 'provisioning' }).eq('tenant_id', tenantId)

    try {
      const result = await this.cfRequest<CfCustomHostname>(
        `/zones/${this.cfZoneId}/custom_hostnames`,
        'POST',
        {
          hostname: domain,
          ssl: {
            method: 'http',
            type:   'dv',
            settings: { min_tls_version: '1.2' },
          },
        },
      )

      await sb.from('tenant_custom_domains').update({
        metadata: { cf_hostname_id: result.id },
      }).eq('tenant_id', tenantId)
    } catch (err) {
      await sb.from('tenant_custom_domains').update({
        ssl_status: 'failed',
      }).eq('tenant_id', tenantId)
    }
  }

  async checkSslStatus(tenantId: string): Promise<void> {
    const sb = this.supabase.getAdminClient()
    const { data: row } = await sb
      .from('tenant_custom_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!row || !row.metadata?.cf_hostname_id) return

    try {
      const result = await this.cfRequest<CfCustomHostname>(
        `/zones/${this.cfZoneId}/custom_hostnames/${row.metadata.cf_hostname_id}`,
      )

      const cfStatus = result.status
      const sslActive = cfStatus === 'active' || result.ssl?.status === 'active'

      await sb.from('tenant_custom_domains').update({
        ssl_status:         sslActive ? 'active' : cfStatus === 'blocked' ? 'failed' : 'provisioning',
        ssl_provisioned_at: sslActive ? new Date().toISOString() : null,
        is_active:          sslActive,
        last_checked_at:    new Date().toISOString(),
      }).eq('id', row.id)

      if (sslActive) {
        const slug = await this.getTenantSlug(tenantId)
        await this.kvWrite(row.domain, slug).catch(() => {})
      }
    } catch {
      // Cloudflare poll failed, will retry next cron cycle
    }
  }

  async removeDomain(tenantId: string): Promise<void> {
    const sb = this.supabase.getAdminClient()
    const { data: row } = await sb
      .from('tenant_custom_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!row) throw new NotFoundException('No custom domain configured')

    // Remove Cloudflare custom hostname
    if (row.metadata?.cf_hostname_id && this.cfZoneId && this.cfApiToken) {
      await this.cfRequest(
        `/zones/${this.cfZoneId}/custom_hostnames/${row.metadata.cf_hostname_id}`,
        'DELETE',
      ).catch(() => {})
    }

    // Remove from KV
    await this.kvDelete(row.domain).catch(() => {})

    // Delete row
    await sb.from('tenant_custom_domains').delete().eq('tenant_id', tenantId)
  }

  // ── Periodic cron: re-check unverified and provisioning domains ──────────────

  @Cron(CronExpression.EVERY_HOUR)
  async periodicVerificationCheck() {
    const sb = this.supabase.getAdminClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Re-check unverified domains created within the last 7 days (< 10 failures)
    const { data: unverified } = await sb
      .from('tenant_custom_domains')
      .select('tenant_id, domain, verification_token, check_failures')
      .eq('is_verified', false)
      .gt('created_at', sevenDaysAgo)
      .lt('check_failures', 10)

    for (const row of unverified ?? []) {
      const verified = await this.checkDnsRecord(row.domain, row.verification_token).catch(() => false)
      if (verified) {
        await this.verifyDomain(row.tenant_id).catch(() => {})
      } else {
        await sb.from('tenant_custom_domains')
          .update({ check_failures: row.check_failures + 1, last_checked_at: new Date().toISOString() })
          .eq('tenant_id', row.tenant_id)
      }
    }

    // 2. Re-check domains that are verified but SSL still provisioning
    const { data: provisioning } = await sb
      .from('tenant_custom_domains')
      .select('tenant_id')
      .eq('is_verified', true)
      .eq('ssl_status', 'provisioning')

    for (const row of provisioning ?? []) {
      await this.checkSslStatus(row.tenant_id).catch(() => {})
    }
  }

  // ── DNS instruction builder ───────────────────────────────────────────────────

  private buildDnsInstructions(domain: string, token: string) {
    return {
      txt_record: {
        name:  `_occasionpro-verify.${domain}`,
        type:  'TXT',
        value: `op-verify=${token}`,
        ttl:   300,
      },
      cname_record: {
        name:   domain,
        type:   'CNAME',
        target: 'cname.occasionpro.in',
        ttl:    300,
        note:   'Add this CNAME to route traffic. Can be added simultaneously with the TXT record.',
      },
      help: 'Add the TXT record to verify ownership, then add the CNAME to route traffic. Changes may take up to 24 hours to propagate.',
    }
  }
}
