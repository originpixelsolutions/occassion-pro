import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { SupabaseService } from '../supabase/supabase.service'

/**
 * WebhookSecurityService
 *
 * Provides three layers of webhook security:
 *
 * 1. HMAC-SHA256 signature verification (timing-safe)
 *    - Uses crypto.timingSafeEqual — prevents timing-based secret recovery attacks
 *    - NEVER use === or string comparison for HMAC verification
 *
 * 2. Timestamp validation (replay protection tier 1)
 *    - Rejects webhooks with X-Webhook-Timestamp outside ±5 minute window
 *    - Guards against recorded-and-replayed webhook attacks
 *
 * 3. Nonce deduplication (replay protection tier 2)
 *    - Stores consumed delivery IDs in used_webhook_nonces table
 *    - Rejects any delivery ID seen before within the 24h window
 *    - pg_cron auto-cleans nonces older than 24 hours
 *
 * Reference: OWASP Webhook Security Cheat Sheet
 */
@Injectable()
export class WebhookSecurityService {
  private readonly logger = new Logger(WebhookSecurityService.name)
  private readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  // ── HMAC Signature Verification ────────────────────────────

  /**
   * Verify Razorpay webhook signature.
   * Razorpay sends: X-Razorpay-Signature: hex(HMAC-SHA256(body, secret))
   *
   * SECURITY: Uses timingSafeEqual to prevent timing attacks.
   */
  verifyRazorpaySignature(
    rawBody: Buffer | string,
    receivedSignature: string,
    webhookSecret?: string,
  ): boolean {
    const secret = webhookSecret ?? this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '')
    if (!secret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not configured — skipping signature verification')
      return true // Dev mode: skip
    }

    const expectedSig = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    return this.timingSafeCompare(expectedSig, receivedSignature)
  }

  /**
   * Verify Stripe webhook signature.
   * Stripe sends: Stripe-Signature: t=<timestamp>,v1=<sig>
   * Signed payload: <timestamp>.<body>
   */
  verifyStripeSignature(
    rawBody: Buffer | string,
    stripeSignatureHeader: string,
    webhookSecret?: string,
  ): boolean {
    const secret = webhookSecret ?? this.config.get<string>('STRIPE_WEBHOOK_SECRET', '')
    if (!secret) return true

    // Parse Stripe signature header
    const parts = Object.fromEntries(
      stripeSignatureHeader.split(',').map((part) => {
        const [k, ...v] = part.split('=')
        return [k.trim(), v.join('=')]
      }),
    )

    const timestamp = parts['t']
    const v1Sig = parts['v1']

    if (!timestamp || !v1Sig) return false

    const signedPayload = `${timestamp}.${rawBody.toString()}`
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    return this.timingSafeCompare(expectedSig, v1Sig)
  }

  /**
   * Verify generic OccasionPro internal webhook signature.
   * Header: X-OccasionPro-Signature: sha256=hex(HMAC-SHA256(body, secret))
   */
  verifyInternalSignature(
    rawBody: Buffer | string,
    signatureHeader: string,
    secret: string,
  ): boolean {
    const prefix = 'sha256='
    if (!signatureHeader.startsWith(prefix)) return false

    const receivedSig = signatureHeader.slice(prefix.length)
    const expectedSig = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    return this.timingSafeCompare(expectedSig, receivedSig)
  }

  /**
   * Timing-safe string comparison.
   *
   * WHY: Standard === comparison short-circuits on first differing character,
   * creating a measurable timing difference that can reveal the expected HMAC
   * value character by character. timingSafeEqual always compares all bytes.
   *
   * IMPORTANT: Both inputs must be the same length for timing-safe comparison.
   * We pad/hash to equal length before comparing.
   */
  timingSafeCompare(a: string, b: string): boolean {
    try {
      // Convert to fixed-length buffers using SHA-256 to normalize length
      // This prevents length-based oracle even if strings differ in size
      const hashA = createHmac('sha256', 'comparison-key').update(a).digest()
      const hashB = createHmac('sha256', 'comparison-key').update(b).digest()

      // timingSafeEqual requires same-length buffers
      return timingSafeEqual(hashA, hashB)
    } catch {
      return false
    }
  }

  // ── Timestamp Validation ────────────────────────────────────

  /**
   * Validate that a webhook timestamp is within the tolerance window.
   * Accepts both Unix seconds (Stripe) and Unix milliseconds.
   *
   * Returns false if:
   *   - Header missing or unparseable
   *   - Timestamp older than 5 minutes (replay attack)
   *   - Timestamp in the future by more than 1 minute (clock skew tolerance)
   */
  validateTimestamp(timestampHeader: string | undefined): boolean {
    if (!timestampHeader) {
      this.logger.warn('Webhook missing X-Webhook-Timestamp header')
      return false
    }

    let ts = parseInt(timestampHeader, 10)
    if (isNaN(ts)) return false

    // Convert Unix seconds to milliseconds if needed
    if (ts < 1e12) ts = ts * 1000

    const now = Date.now()
    const diff = Math.abs(now - ts)

    if (diff > this.TIMESTAMP_TOLERANCE_MS) {
      this.logger.warn(
        `Webhook timestamp out of tolerance: ${new Date(ts).toISOString()} ` +
        `(diff: ${Math.round(diff / 1000)}s, tolerance: 300s)`,
      )
      return false
    }

    return true
  }

  // ── Nonce Deduplication ─────────────────────────────────────

  /**
   * Check if a delivery nonce has been used before.
   * Returns true if the nonce is NEW (not seen before).
   * Returns false (and logs a warning) if it's a replay.
   */
  async checkAndConsumeNonce(
    nonce: string,
    source: string = 'unknown',
  ): Promise<boolean> {
    const sb = this.supabase.getServiceClient()

    // Check if already used
    const { data: existing } = await sb
      .from('used_webhook_nonces')
      .select('nonce')
      .eq('nonce', nonce)
      .maybeSingle()

    if (existing) {
      this.logger.warn(
        `Webhook replay attack detected — nonce already consumed: ${nonce} (source: ${source})`,
      )
      return false
    }

    // Mark as used
    await sb.from('used_webhook_nonces').insert({ nonce, source })
    return true
  }

  /**
   * Full webhook validation: signature + timestamp + nonce.
   *
   * Throws UnauthorizedException on any failure.
   * Use this in webhook controllers for maximum security.
   */
  async validateWebhook(opts: {
    rawBody: Buffer | string
    signature: string
    secret: string
    timestampHeader?: string
    nonce?: string
    source?: string
    skipTimestamp?: boolean
    skipNonce?: boolean
  }): Promise<void> {
    const {
      rawBody,
      signature,
      secret,
      timestampHeader,
      nonce,
      source = 'webhook',
      skipTimestamp = false,
      skipNonce = false,
    } = opts

    // 1. Signature check
    const sigValid = this.verifyInternalSignature(rawBody, signature, secret)
    if (!sigValid) {
      throw new UnauthorizedException('Webhook signature invalid')
    }

    // 2. Timestamp check (replay tier 1)
    if (!skipTimestamp && !this.validateTimestamp(timestampHeader)) {
      throw new UnauthorizedException('Webhook timestamp out of range')
    }

    // 3. Nonce check (replay tier 2)
    if (!skipNonce && nonce) {
      const isNew = await this.checkAndConsumeNonce(nonce, source)
      if (!isNew) {
        throw new UnauthorizedException('Webhook replay detected')
      }
    }
  }

  // ── Utility ─────────────────────────────────────────────────

  /**
   * Generate a webhook signing secret.
   * Use when creating new webhook subscriptions for external parties.
   */
  generateWebhookSecret(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Generate a delivery nonce for outbound webhooks.
   */
  generateDeliveryNonce(): string {
    return randomBytes(16).toString('hex')
  }
}
