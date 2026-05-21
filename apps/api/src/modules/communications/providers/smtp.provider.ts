import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../interfaces/email-provider.interface'

/**
 * SmtpProvider — nodemailer-based SMTP email provider.
 *
 * Required env vars:
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       e.g. 587 (TLS) or 465 (SSL)
 *   SMTP_USER       SMTP login username
 *   SMTP_PASS       SMTP login password
 *
 * Optional env vars:
 *   SMTP_SECURE     'true' for SSL (port 465), defaults to false (STARTTLS)
 *   SMTP_POOL       'true' to use connection pool (good for bulk sending)
 *   SMTP_MAX_CONNS  pool size, default 5
 *   FROM_EMAIL      sender address, default noreply@occasionpro.in
 *   FROM_NAME       sender display name, default OccasionPro
 *
 * Compatible with: Gmail (via App Password), Amazon SES, Postfix, Mailpit (local dev)
 */
@Injectable()
export class SmtpProvider implements IEmailProvider, OnModuleDestroy {
  private readonly logger = new Logger(SmtpProvider.name)
  private readonly transporter: nodemailer.Transporter
  private readonly fromEmail: string
  private readonly fromName: string

  constructor(private readonly config: ConfigService) {
    this.fromEmail = config.get<string>('FROM_EMAIL') ?? 'noreply@occasionpro.in'
    this.fromName  = config.get<string>('FROM_NAME')  ?? 'OccasionPro'

    const host    = config.get<string>('SMTP_HOST')  ?? 'localhost'
    const port    = config.get<number>('SMTP_PORT')  ?? 587
    const user    = config.get<string>('SMTP_USER')
    const pass    = config.get<string>('SMTP_PASS')
    const secure  = config.get<string>('SMTP_SECURE') === 'true'
    const pool    = config.get<string>('SMTP_POOL')   === 'true'
    const maxConn = config.get<number>('SMTP_MAX_CONNS') ?? 5

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool,
      maxConnections: maxConn,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        // Allow self-signed certs in dev; strip in production if needed
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    })

    this.logger.log(`SMTP provider configured — ${host}:${port} (secure: ${secure}, pool: ${pool})`)
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter.close()
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const from = this.buildFrom(options.from)

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from,
        to:      Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html:    options.html,
        text:    options.text,
        replyTo: options.replyTo,
      }

      if (options.attachments?.length) {
        mailOptions.attachments = options.attachments.map(att => ({
          filename:    att.filename,
          content:     att.content,
          contentType: att.contentType,
        }))
      }

      const info = await this.transporter.sendMail(mailOptions)
      this.logger.debug(`Email sent via SMTP: ${info.messageId}`)
      return { success: true, messageId: info.messageId }
    } catch (err: any) {
      this.logger.error(`SMTP send failed: ${err.message}`, err.stack)
      return { success: false, error: err.message }
    }
  }

  async sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
    // SMTP doesn't have a native bulk API — send sequentially to respect rate limits
    // In pool mode nodemailer reuses connections automatically
    const results: SendEmailResult[] = []

    for (const email of emails) {
      const result = await this.sendEmail(email)
      results.push(result)

      // Small gap between messages to avoid triggering spam filters
      if (results.length < emails.length) {
        await this.sleep(100)
      }
    }

    const failed = results.filter(r => !r.success).length
    if (failed > 0) {
      this.logger.warn(`SMTP bulk: ${results.length - failed}/${results.length} sent, ${failed} failed`)
    }

    return results
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private buildFrom(override?: string): string {
    if (override) return override
    return `"${this.fromName}" <${this.fromEmail}>`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
