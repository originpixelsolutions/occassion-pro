import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../interfaces/email-provider.interface'

/**
 * SendGridProvider — direct fetch to SendGrid Mail Send API v3.
 * No SDK dependency; uses native fetch (Node 18+) for a zero-overhead implementation.
 *
 * Required env vars:
 *   SENDGRID_API_KEY   SG.xxxx...
 *
 * Optional env vars:
 *   FROM_EMAIL         sender address, default noreply@occasionpro.in
 *   FROM_NAME          sender display name, default OccasionPro
 *
 * API docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 * Batch:    https://docs.sendgrid.com/api-reference/mail-send/multiple-emails-to-multiple-recipients
 */
@Injectable()
export class SendGridProvider implements IEmailProvider {
  private readonly logger = new Logger(SendGridProvider.name)
  private readonly apiKey: string
  private readonly fromEmail: string
  private readonly fromName: string
  private readonly baseUrl = 'https://api.sendgrid.com/v3'

  constructor(private readonly config: ConfigService) {
    this.apiKey    = config.get<string>('SENDGRID_API_KEY') ?? ''
    this.fromEmail = config.get<string>('FROM_EMAIL') ?? 'noreply@occasionpro.in'
    this.fromName  = config.get<string>('FROM_NAME')  ?? 'OccasionPro'

    if (!this.apiKey) {
      this.logger.warn('SENDGRID_API_KEY is not set — emails will fail')
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const body = this.buildSinglePayload(options)

    try {
      const res = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      })

      if (res.status === 202) {
        // SendGrid returns 202 Accepted with no body on success
        const messageId = res.headers.get('X-Message-Id') ?? undefined
        return { success: true, messageId }
      }

      const data = await res.json().catch(() => ({})) as any
      const errorMsg = data?.errors?.[0]?.message ?? `HTTP ${res.status}`
      this.logger.error(`SendGrid send failed: ${errorMsg}`, JSON.stringify(data))
      return { success: false, error: errorMsg }
    } catch (err: any) {
      this.logger.error(`SendGrid network error: ${err.message}`, err.stack)
      return { success: false, error: err.message }
    }
  }

  async sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
    if (emails.length === 0) return []

    // SendGrid supports multiple personalizations in a single API call (up to 1000)
    // Group batches of 1000 to stay within the limit
    const BATCH = 1000
    const results: SendEmailResult[] = new Array(emails.length)

    for (let i = 0; i < emails.length; i += BATCH) {
      const chunk = emails.slice(i, i + BATCH)
      const chunkResults = await this.sendChunk(chunk)
      chunkResults.forEach((r, j) => { results[i + j] = r })
    }

    const failed = results.filter(r => !r.success).length
    if (failed > 0) {
      this.logger.warn(`SendGrid bulk: ${emails.length - failed}/${emails.length} sent, ${failed} failed`)
    }

    return results
  }

  // ─── private helpers ─────────────────────────────────────────────────────────

  private async sendChunk(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
    // Build a single payload with multiple personalizations
    // Each personalization can have different to/subject/content
    const payload = this.buildBulkPayload(emails)

    try {
      const res = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      })

      if (res.status === 202) {
        // All accepted — mark all as success
        return emails.map(() => ({ success: true }))
      }

      // On partial or full failure, fall back to individual sends for this chunk
      this.logger.warn(`SendGrid bulk chunk returned ${res.status} — falling back to individual sends`)
      return Promise.all(emails.map(e => this.sendEmail(e)))
    } catch (err: any) {
      this.logger.error(`SendGrid bulk chunk error: ${err.message}`)
      return Promise.all(emails.map(e => this.sendEmail(e)))
    }
  }

  private buildSinglePayload(options: SendEmailOptions): object {
    const to = Array.isArray(options.to)
      ? options.to.map(email => ({ email }))
      : [{ email: options.to }]

    const payload: any = {
      personalizations: [{
        to,
        subject: options.subject,
      }],
      from: this.buildFrom(options.from),
      content: [
        { type: 'text/html', value: options.html },
      ],
    }

    if (options.text) {
      payload.content.unshift({ type: 'text/plain', value: options.text })
    }

    if (options.replyTo) {
      payload.reply_to = { email: options.replyTo }
    }

    if (options.attachments?.length) {
      payload.attachments = options.attachments.map(att => ({
        filename:    att.filename,
        content:     Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : Buffer.from(att.content as string).toString('base64'),
        type:        att.contentType ?? 'application/octet-stream',
        disposition: 'attachment',
      }))
    }

    return payload
  }

  /** Build a single API payload using multiple personalizations for bulk sends */
  private buildBulkPayload(emails: SendEmailOptions[]): object {
    // Use the first email's from/content as the shared base
    const first = emails[0]

    const personalizations = emails.map(e => ({
      to: Array.isArray(e.to) ? e.to.map(email => ({ email })) : [{ email: e.to }],
      subject: e.subject,
    }))

    const payload: any = {
      personalizations,
      from: this.buildFrom(first.from),
      content: [
        { type: 'text/html', value: first.html },
      ],
    }

    if (first.text) {
      payload.content.unshift({ type: 'text/plain', value: first.text })
    }

    return payload
  }

  private buildFrom(override?: string): { email: string; name?: string } {
    if (override) {
      // Parse "Name <email>" format if provided
      const match = override.match(/^"?(.+?)"?\s*<(.+)>$/)
      if (match) return { name: match[1], email: match[2] }
      return { email: override }
    }
    return { email: this.fromEmail, name: this.fromName }
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type':  'application/json',
    }
  }
}
