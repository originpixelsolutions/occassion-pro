import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../interfaces/email-provider.interface'

/**
 * Resend email provider.
 * Uses fetch directly (no SDK dependency) to keep bundle small.
 * Falls back gracefully — never throws, always returns a result object.
 */
@Injectable()
export class ResendProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendProvider.name)
  private readonly apiKey: string
  private readonly fromEmail: string
  private readonly fromName: string

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY') ?? ''
    this.fromEmail = config.get<string>('FROM_EMAIL') ?? 'noreply@occasionpro.in'
    this.fromName = config.get<string>('FROM_NAME') ?? 'OccasionPro'
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      if (!this.apiKey) {
        this.logger.warn('RESEND_API_KEY not configured — email not sent')
        return { success: false, error: 'Email provider not configured' }
      }

      const from = options.from ?? `${this.fromName} <${this.fromEmail}>`
      const to = Array.isArray(options.to) ? options.to : [options.to]

      const body: Record<string, unknown> = {
        from,
        to,
        subject: options.subject,
        html: options.html,
      }
      if (options.text) body.text = options.text
      if (options.replyTo) body.reply_to = options.replyTo
      if (options.attachments?.length) {
        body.attachments = options.attachments.map(a => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content)
            ? a.content.toString('base64')
            : Buffer.from(a.content as string).toString('base64'),
          content_type: a.contentType ?? 'application/octet-stream',
        }))
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json() as { id?: string; error?: { message?: string } }

      if (!response.ok) {
        const msg = data?.error?.message ?? `HTTP ${response.status}`
        this.logger.error(`Resend error: ${msg}`)
        return { success: false, error: msg }
      }

      this.logger.log(`Email sent via Resend: ${data.id} → ${to.join(', ')}`)
      return { success: true, messageId: data.id }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`ResendProvider.sendEmail failed: ${msg}`)
      return { success: false, error: msg }
    }
  }

  async sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
    // Resend supports batch sending via /emails/batch — max 100 per request
    try {
      if (!this.apiKey) {
        return emails.map(() => ({ success: false, error: 'Email provider not configured' }))
      }

      const chunks = this.chunk(emails, 100)
      const results: SendEmailResult[] = []

      for (const chunk of chunks) {
        const batch = chunk.map(options => {
          const from = options.from ?? `${this.fromName} <${this.fromEmail}>`
          const to = Array.isArray(options.to) ? options.to : [options.to]
          return { from, to, subject: options.subject, html: options.html, text: options.text }
        })

        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          const err = await response.text()
          results.push(...chunk.map(() => ({ success: false, error: err })))
        } else {
          const data = await response.json() as { data?: Array<{ id: string }> }
          const ids = data.data ?? []
          results.push(...chunk.map((_, i) => ({
            success: true,
            messageId: ids[i]?.id,
          })))
        }
      }

      return results
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return emails.map(() => ({ success: false, error: msg }))
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    )
  }
}
