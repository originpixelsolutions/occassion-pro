import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { FieldEncryptionService } from '../crypto/field-encryption.service'

export type SecurityAction =
  | 'auth.login_success'
  | 'auth.login_failure'
  | 'auth.logout'
  | 'auth.token_refresh'
  | 'auth.otp_sent'
  | 'auth.otp_verified'
  | 'auth.magic_link_sent'
  | 'auth.magic_link_consumed'
  | 'auth.brute_force_lockout'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.used'
  | 'api_key.quota_exceeded'
  | 'webhook.signature_invalid'
  | 'webhook.replay_detected'
  | 'webhook.delivered'
  | 'admin.tenant_suspended'
  | 'admin.tenant_reactivated'
  | 'admin.plan_changed'
  | 'admin.user_impersonated'
  | 'data.export_requested'
  | 'data.bulk_delete'
  | 'data.sensitive_access'
  | 'security.sql_injection_attempt'
  | 'security.xss_attempt'
  | 'security.rate_limit_exceeded'
  | 'security.unauthorized_tenant_access'

export interface AuditEventOpts {
  action: SecurityAction
  tenantId?: string
  userId?: string
  resourceType?: string
  resourceId?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  success?: boolean
  errorMessage?: string
}

/**
 * SecurityAuditService
 *
 * Writes security events to the security_audit_log table.
 * All events are fire-and-forget (non-blocking) to avoid
 * adding latency to the request path.
 *
 * IP and user agent are hashed before storage for privacy.
 *
 * Usage:
 *   await this.audit.log({
 *     action: 'auth.login_success',
 *     tenantId: tenantId,
 *     userId: user.id,
 *     ip: request.ip,
 *   })
 */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  /**
   * Log a security event asynchronously.
   * Never throws — audit logging must not break the main request.
   */
  log(opts: AuditEventOpts): void {
    // Fire and forget — don't await
    this.writeEvent(opts).catch((err) => {
      this.logger.error(`Failed to write security audit log: ${err.message}`)
    })
  }

  /**
   * Log and await — use when you need confirmation (e.g. compliance reports).
   */
  async logAndWait(opts: AuditEventOpts): Promise<void> {
    await this.writeEvent(opts)
  }

  private async writeEvent(opts: AuditEventOpts): Promise<void> {
    const {
      action,
      tenantId,
      userId,
      resourceType,
      resourceId,
      ip,
      userAgent,
      metadata = {},
      success = true,
      errorMessage,
    } = opts

    const ipHash = ip ? this.encryption.hashForStorage(ip) : undefined
    const userAgentHash = userAgent
      ? this.encryption.hashForStorage(userAgent)
      : undefined

    const sb = this.supabase.getServiceClient()
    const { error } = await sb.from('security_audit_log').insert({
      action,
      tenant_id:       tenantId ?? null,
      user_id:         userId ?? null,
      resource_type:   resourceType ?? null,
      resource_id:     resourceId ?? null,
      ip_hash:         ipHash ?? null,
      user_agent_hash: userAgentHash ?? null,
      metadata,
      success,
      error_message:   errorMessage ?? null,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Helper: extract IP from Fastify request object.
   * Respects X-Forwarded-For when behind a trusted proxy.
   */
  extractIp(request: any): string {
    return (
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      request.ip ??
      request.socket?.remoteAddress ??
      'unknown'
    )
  }
}
