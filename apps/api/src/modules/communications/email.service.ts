import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IEmailProvider, SendEmailOptions, SendEmailResult } from './interfaces/email-provider.interface'
import { ResendProvider } from './providers/resend.provider'
import { SmtpProvider } from './providers/smtp.provider'
import { SendGridProvider } from './providers/sendgrid.provider'
import { MailgunProvider } from './providers/mailgun.provider'

/**
 * EmailService — provider-agnostic email gateway.
 *
 * Provider is selected via EMAIL_PROVIDER env var:
 *   resend    (default) — Resend API, great for transactional email
 *   smtp      — SMTP via nodemailer (works with Gmail, SES, Postfix, Mailpit)
 *   sendgrid  — SendGrid Mail Send API v3
 *   mailgun   — Mailgun Messages API
 *
 * Usage:
 *   // With pre-built template
 *   emailService.send(EmailTemplates.welcome(params), 'user@example.com')
 *
 *   // Raw email
 *   emailService.sendEmail({ to, subject, html })
 *
 *   // Bulk
 *   emailService.sendBulk([{ to, subject, html }, ...])
 *
 *   // Fire-and-forget (never throws)
 *   emailService.sendAsync({ to, subject, html })
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly provider: IEmailProvider

  constructor(
    private readonly config: ConfigService,
    private readonly resend: ResendProvider,
    private readonly smtp: SmtpProvider,
    private readonly sendgrid: SendGridProvider,
    private readonly mailgun: MailgunProvider,
  ) {
    const providerName = (config.get<string>('EMAIL_PROVIDER') ?? 'resend').toLowerCase()

    switch (providerName) {
      case 'smtp':
      case 'nodemailer':
        this.provider = this.smtp
        this.logger.log('Email provider: SMTP (nodemailer)')
        break

      case 'sendgrid':
        this.provider = this.sendgrid
        this.logger.log('Email provider: SendGrid')
        break

      case 'mailgun':
        this.provider = this.mailgun
        this.logger.log('Email provider: Mailgun')
        break

      case 'resend':
      default:
        this.provider = this.resend
        this.logger.log('Email provider: Resend')
        break
    }
  }

  /**
   * Send a single email using a pre-built template result.
   *
   * @example
   *   await emailService.send(EmailTemplates.welcome({ name: 'Alice', workspaceUrl }), 'alice@co.com')
   */
  async send(
    template: { subject: string; html: string; text?: string },
    to: string | string[],
    from?: string,
  ): Promise<SendEmailResult> {
    return this.provider.sendEmail({ ...template, to, from })
  }

  /** Send a fully-configured raw email */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.provider.sendEmail(options)
  }

  /** Send to multiple recipients / multiple different messages in bulk */
  async sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
    return this.provider.sendBulk(emails)
  }

  /**
   * Fire-and-forget send — logs failures but never throws.
   * Ideal for non-critical notifications (welcome emails, trial warnings, etc.)
   * where a delivery failure must never break the calling request.
   */
  sendAsync(options: SendEmailOptions): void {
    this.provider.sendEmail(options).then(result => {
      if (!result.success) {
        this.logger.warn(`Async email to ${options.to} failed: ${result.error}`)
      }
    }).catch(err => {
      this.logger.error(`Async email error: ${err?.message ?? err}`)
    })
  }
}
