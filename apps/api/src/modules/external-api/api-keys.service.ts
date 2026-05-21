import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import * as crypto from 'crypto'

export interface CreateApiKeyDto {
  name: string
  scopes: string[]
  environment?: 'live' | 'test'
  description?: string
  rate_limit_rpm?: number
  rate_limit_daily?: number
  allowed_ips?: string[]
  expires_at?: string
}

export interface ApproveKeyDto {
  approved: boolean
  rejection_reason?: string
  rate_limit_rpm?: number
  rate_limit_daily?: number
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Generate a new API key ─────────────────────────────────────────────
  async create(tenantId: string, userId: string, dto: CreateApiKeyDto) {
    const client = this.supabase.serviceClient

    // Validate scopes exist
    const { data: validScopes } = await client
      .from('api_scopes')
      .select('scope')
      .in('scope', dto.scopes)

    const validScopeList = validScopes?.map(s => s.scope) ?? []
    const invalidScopes = dto.scopes.filter(s => !validScopeList.includes(s))
    if (invalidScopes.length) {
      throw new BadRequestException(`Invalid scopes: ${invalidScopes.join(', ')}`)
    }

    // Check sensitive scope limits per plan (basic check)
    const sensitiveRequested = dto.scopes.some(s =>
      ['events:delete','guests:delete','team:write','finance:write','admin:write'].includes(s)
    )

    // Generate key: op_live_<32 random bytes base64url>
    const env = dto.environment ?? 'live'
    const rawKey = `op_${env}_${crypto.randomBytes(32).toString('base64url')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyHint = rawKey.slice(-4)
    const keyPrefix = `op_${env}_`

    const { data, error } = await client
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        key_hint: keyHint,
        scopes: dto.scopes,
        environment: env,
        description: dto.description,
        rate_limit_rpm: dto.rate_limit_rpm ?? 60,
        rate_limit_daily: dto.rate_limit_daily ?? 10000,
        allowed_ips: dto.allowed_ips ?? null,
        expires_at: dto.expires_at ?? null,
        created_by: userId,
        status: sensitiveRequested ? 'pending_approval' : 'active',
        approval_status: sensitiveRequested ? 'pending' : 'approved',
        approved_at: sensitiveRequested ? null : new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw new ConflictException(error.message)

    // Return the raw key ONCE — never stored
    return { ...data, raw_key: rawKey }
  }

  // ─── List keys for a tenant ─────────────────────────────────────────────
  async list(tenantId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('api_keys')
      .select('id,name,key_prefix,key_hint,scopes,environment,status,approval_status,rate_limit_rpm,rate_limit_daily,last_used_at,usage_count,expires_at,created_at,description')
      .eq('tenant_id', tenantId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Revoke a key ───────────────────────────────────────────────────────
  async revoke(tenantId: string, keyId: string) {
    const key = await this.getKey(tenantId, keyId)
    if (key.status === 'revoked') throw new ConflictException('Key already revoked')

    await this.supabase.serviceClient
      .from('api_keys')
      .update({ status: 'revoked' })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)

    return { revoked: true }
  }

  // ─── Super Admin: list pending approvals ────────────────────────────────
  async listPending() {
    const { data, error } = await this.supabase.getServiceClient()
      .from('api_keys')
      .select(`
        id, name, key_prefix, key_hint, scopes, environment,
        description, rate_limit_rpm, rate_limit_daily,
        created_at, created_by,
        tenant:tenants(id, name, slug)
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Super Admin: approve / reject ──────────────────────────────────────
  async adminApprove(keyId: string, actorId: string, dto: ApproveKeyDto) {
    const update: Record<string, any> = {
      approval_status: dto.approved ? 'approved' : 'rejected',
      approved_by: actorId,
      approved_at: new Date().toISOString(),
    }

    if (dto.approved) {
      update.status = 'active'
      if (dto.rate_limit_rpm)   update.rate_limit_rpm = dto.rate_limit_rpm
      if (dto.rate_limit_daily) update.rate_limit_daily = dto.rate_limit_daily
    } else {
      update.status = 'revoked'
      update.rejection_reason = dto.rejection_reason ?? 'Rejected by administrator'
    }

    const { data, error } = await this.supabase.getServiceClient()
      .from('api_keys')
      .update(update)
      .eq('id', keyId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Validate a raw API key (used by ApiKeyGuard) ───────────────────────
  async validateKey(rawKey: string): Promise<{ keyRecord: any; tenantId: string } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const { data } = await this.supabase.getServiceClient()
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .single()

    if (!data) return null

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null

    // Update last_used_at and usage_count asynchronously (fire-and-forget)
    this.supabase.getServiceClient()
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString(), usage_count: data.usage_count + 1 })
      .eq('id', data.id)
      .then(() => {})

    return { keyRecord: data, tenantId: data.tenant_id }
  }

  // ─── Usage stats ────────────────────────────────────────────────────────
  async getUsage(tenantId: string, keyId: string, days = 7) {
    await this.getKey(tenantId, keyId)

    const since = new Date(Date.now() - days * 86400_000).toISOString()
    const { data, error } = await this.supabase.serviceClient
      .from('api_usage_logs')
      .select('requested_at, status_code, response_ms, endpoint, method')
      .eq('api_key_id', keyId)
      .gte('requested_at', since)
      .order('requested_at', { ascending: false })
      .limit(500)

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Record usage log ────────────────────────────────────────────────────
  async logUsage(entry: {
    api_key_id: string; tenant_id: string; endpoint: string
    method: string; status_code: number; response_ms: number
    ip_address?: string; user_agent?: string; error_code?: string
  }) {
    await this.supabase.getServiceClient().from('api_usage_logs').insert(entry)
  }

  // ─── Get available scopes ────────────────────────────────────────────────
  async getScopes() {
    const { data } = await this.supabase.serviceClient
      .from('api_scopes')
      .select('*')
      .order('category')
    return data
  }

  private async getKey(tenantId: string, keyId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('API key not found')
    return data
  }
}
