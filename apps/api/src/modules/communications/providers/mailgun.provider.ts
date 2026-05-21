import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../interfaces/email-provider.interface'

/**
 * MailgunProvider — direct fetch to Mailgun Messages API.
 * No SDK dependency; uses native fetch (Node 18+).
 *
 * Required env vars:
 *   MAILGUN_API_KEY   key-xxxx...
 *   MAILGUN_DOMAIN    mg.occasionpro.in (your sending domain)
 *
 * Optional env vars:
 *   MAILGUN_REGION    'eu' for EU endpoint, defaults to US endpoint
 *   FROM_EMAIL        sender address, default noreply@occasionpro.in
 *   FROM_NAME         sender display name, default OccasionPro
 *
 * API docs: https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages
 */
@Injectable()
export class MailgunProvider implements IEmailProvider {
  private readonly logger = new Logger(MailgunProvider.name)
  private readonly apiKey: string
  private readonly domain: string
  private readonly fromEmail: string
  private readonly fromName: string
  private readonly baseUrl: string

  constructor(private readonly config: ConfigService) {
    this.apiKey    = config.get<string>('MAILGUN_API_KEY') ?? ''
    this.domain    = config.get<string>('MAILGUN_DOMAIN')  ?? ''
    this.fromEmail = config.get<string>('FROM_EMAIL') ?? 'noreply@occasionpro.in'
    this.fromName  = config.get<string>('FROM_NAME')  ?? 'OccasionPro'

    const region = config.get<string>('MAILGUN_REGION') ?? 'us'
    this.baseUrl = region === 'eu'
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3'

    if (!this.apiKey || !this.domain) {
      this.logger.warn('MAILGUN_API_KEY or MAILGUN_DOMAIN is not set — emails will fail')
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const formData = this.buildFormData(options)

    try {
      const res = await fetch(`${this.baseUrl}/${this.domain}/messages`, {
        method:  'POST',
        headers: { Authorization: this.authHeader() },
        body:    formData,
      })

      const data = await res.json().catch(() => ({})) as any

      if (res.ok) {
        return { success: true, messageId: data.id }
      }

      const errorMsg = data.message ?? `HTTP ${res.status}`
      this.logger.error(`Mailgun send failed: ${errorMsg}`, JSON.stringify(data))
      return { success: false, error: errorMsg }
    } catch (err: any) {
      this.logger.error(`Mailgun network error: ${err.message}`, err.stack)
      return { success: false, error: err.message }
    }
  }

  async sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
    if (emails.length === 0) return []

    // Mailgun supports recipient variables for bulk personalized sends,
    // but for different subjects/bodies we send individually in parallel batches.
    // Group into batches of 20 to avoid overwhelming the API.
    const BATCH = 20
    const results: SendEmailResult[] = []

    for (let i = 0; i < emails.length; i += BATCH) {
      const chunk = emails.slice(i, i + BATCH)
      const chunkResults = await Promise.all(chunk.map(e => this.sendEmail(e)))
      results.push(...chunkResults)
    }

    const failed = results.filter(r => !r.success).length
    if (failed > 0) {
      this.logger.warn(`Mailgun bulk: ${emails.length - failed}/${emails.length} sent, ${failed} failed`)
    }

    return results
  }

  // ─── private helpers ─────────────────────────────────────────────────────────

  /**
   * Mailgun API uses multipart/form-data (not JSON).
   * We use FormData which is built into Node 18+.
   */
  private buildFormData(options: SendEmailOptions): FormData {
    const form = new FormData()

    form.append('from', this.buildFrom(options.from))
    form.append('to', Array.isArray(options.to) ? options.to.join(',') : options.to)
    form.append('subject', options.subject)
    form.append('html', options.html)

    if (options.text)    form.append('text', options.text)
    if (options.replyTo) form.append('h:Reply-To', options.replyTo)

    // Attachments: Mailgun expects Blob/File in FormData
    if (options.attachments?.length) {
      for (const att of options.attachments) {
        const blob = new Blob(
          [Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content as string)],
          { type: att.contentType ?? 'application/octet-stream' },
        )
        form.append('attachment', blob, att.filename)
      }
    }

    return form
  }

  private buildFrom(override?: string): string {
    if (override) return override
    return `${this.fromName} <${this.fromEmail}>`
  }

  /** Basic auth: API credentials for Mailgun are "api:YOUR_KEY" base64-encoded */
  private authHeader(): string {
    const credentials = Buffer.from(`api:${this.apiKey}`).toString('base64')
    return `Basic ${credentials}`
  }
}
