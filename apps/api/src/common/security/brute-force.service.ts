import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { FieldEncryptionService } from '../crypto/field-encryption.service'

/**
 * BruteForceService
 *
 * Tracks authentication attempts and enforces lockout policies.
 *
 * Policy defaults:
 *   - Max failures: 10 attempts
 *   - Window: 15 minutes
 *   - Lockout: remainder of the window after 10th failure
 *
 * Storage: auth_attempts table (migration 081)
 * Privacy: IPs and identifiers are stored as SHA-256 hashes only
 */
@Injectable()
export class BruteForceService {
  private readonly logger = new Logger(BruteForceService.name)

  // Default policy
  private readonly MAX_FAILURES = 10
  private readonly WINDOW_MINUTES = 15

  // Stricter policies for sensitive endpoints
  private readonly OTP_MAX_FAILURES = 5
  private readonly OTP_WINDOW_MINUTES = 15

  constructor(
    private readonly supabase: SupabaseService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  /**
   * Record an authentication attempt and check if the account is locked.
   *
   * @param opts.ip          Raw IP address (will be hashed before storage)
   * @param opts.identifier  Email, phone, or token (will be hashed)
   * @param opts.type        Attempt type matching attempt_type_enum
   * @param opts.success     Whether this attempt succeeded
   * @param opts.tenantId    Optional tenant context
   *
   * Throws UnauthorizedException if the account is locked BEFORE recording
   * (to prevent enumeration of attempt count on locked accounts).
   */
  async recordAttempt(opts: {
    ip: string
    identifier: string
    type: string
    success: boolean
    tenantId?: string
    userAgent?: string
  }): Promise<void> {
    const { ip, identifier, type, success, tenantId, userAgent } = opts

    // Hash sensitive values before storage
    const ipHash = this.encryption.hashForStorage(ip)
    const identifierHash = this.encryption.hashForStorage(identifier)
    const userAgentHash = userAgent
      ? this.encryption.hashForStorage(userAgent)
      : undefined

    // Check lockout BEFORE recording failure (fail-fast)
    if (!success) {
      await this.checkLockout(ipHash, identifierHash, type)
    }

    // Record the attempt
    const sb = this.supabase.getServiceClient()
    const { error } = await sb.from('auth_attempts').insert({
      ip_hash:          ipHash,
      identifier_hash:  identifierHash,
      attempt_type:     type,
      success,
      tenant_id:        tenantId ?? null,
      user_agent_hash:  userAgentHash ?? null,
    })

    if (error) {
      this.logger.error(`Failed to record auth attempt: ${error.message}`)
      // Don't throw — don't let logging failure block auth
    }

    // If success, optionally clean up old failures for this identifier
    if (success) {
      // We don't delete attempts — they're audit records
      // But we could reset a Redis counter here in a future enhancement
    }
  }

  /**
   * Check if an ip+identifier combo is currently locked out.
   * Throws TooManyRequestsException if locked.
   */
  async checkLockout(
    ipHash: string,
    identifierHash: string,
    type: string,
  ): Promise<void> {
    const maxFailures = type.includes('otp') ? this.OTP_MAX_FAILURES : this.MAX_FAILURES
    const windowMinutes = type.includes('otp') ? this.OTP_WINDOW_MINUTES : this.WINDOW_MINUTES

    const sb = this.supabase.getServiceClient()
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

    const { count, error } = await sb
      .from('auth_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('identifier_hash', identifierHash)
      .eq('attempt_type', type)
      .eq('success', false)
      .gte('attempted_at', windowStart)

    if (error) {
      this.logger.error(`Failed to check lockout: ${error.message}`)
      return // Fail open — don't block auth if check fails
    }

    const failureCount = count ?? 0
    if (failureCount >= maxFailures) {
      this.logger.warn(
        `Account locked: ${failureCount} failures for type=${type} in ${windowMinutes}min window`,
      )
      throw new UnauthorizedException(
        `Too many failed attempts. Please try again in ${windowMinutes} minutes.`,
      )
    }
  }

  /**
   * Check if an IP alone is rate-limited across ALL attempt types.
   * Use for IP-level blocking (e.g. DDoS / credential stuffing).
   */
  async checkIpThrottle(ip: string, maxAttempts = 50): Promise<void> {
    const ipHash = this.encryption.hashForStorage(ip)
    const sb = this.supabase.getServiceClient()
    const windowStart = new Date(Date.now() - this.WINDOW_MINUTES * 60 * 1000).toISOString()

    const { count } = await sb
      .from('auth_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('success', false)
      .gte('attempted_at', windowStart)

    if ((count ?? 0) >= maxAttempts) {
      this.logger.warn(`IP throttled: ${(count ?? 0)} failures in 15 min window`)
      throw new UnauthorizedException(
        'Too many requests from this IP address. Please try again later.',
      )
    }
  }

  /**
   * Check lockout using raw (unhashed) ip + identifier.
   * Convenience wrapper for service layer use.
   */
  async checkRawLockout(
    ip: string,
    identifier: string,
    type: string,
  ): Promise<void> {
    const ipHash = this.encryption.hashForStorage(ip)
    const identifierHash = this.encryption.hashForStorage(identifier)
    await this.checkLockout(ipHash, identifierHash, type)
  }
}
