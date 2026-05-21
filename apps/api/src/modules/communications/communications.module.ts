import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

// Email providers
import { ResendProvider }    from './providers/resend.provider'
import { SmtpProvider }      from './providers/smtp.provider'
import { SendGridProvider }  from './providers/sendgrid.provider'
import { MailgunProvider }   from './providers/mailgun.provider'

// SMS / WhatsApp providers
import { Fast2SMSProvider }      from './providers/fast2sms.provider'
import { BaileysProvider }       from './providers/baileys.provider'
import { MetaCloudApiProvider }  from './providers/meta-cloud-api.provider'

// Services
import { EmailService }               from './email.service'
import { SMSService }                 from './sms.service'
import { WhatsAppService }            from './whatsapp.service'
import { WhatsAppBroadcastService }   from './whatsapp-broadcast.service'

// Controllers
import { CommunicationsController }      from './communications.controller'
import { WhatsAppBroadcastController }   from './whatsapp-broadcast.controller'

/**
 * CommunicationsModule
 *
 * Provides Email, SMS, and WhatsApp messaging capabilities across the platform.
 *
 * ─── Email provider selection ─────────────────────────────────────────────────
 *   EMAIL_PROVIDER=resend     (default) — Resend transactional email API
 *   EMAIL_PROVIDER=smtp       — SMTP via nodemailer (Gmail, SES, Mailpit, Postfix)
 *   EMAIL_PROVIDER=sendgrid   — SendGrid Mail Send API v3
 *   EMAIL_PROVIDER=mailgun    — Mailgun Messages API
 *
 * ─── SMS provider selection ────────────────────────────────────────────────────
 *   SMS_PROVIDER=fast2sms     (default) — Fast2SMS India
 *
 * ─── WhatsApp provider selection ───────────────────────────────────────────────
 *   WHATSAPP_PROVIDER=meta    (default) — Meta Cloud API (official WhatsApp Business)
 *   WHATSAPP_PROVIDER=baileys — Baileys self-hosted (legacy / dev mode)
 *   WHATSAPP_SMS_FALLBACK=true — fall back to SMS if WhatsApp delivery fails
 *
 * ─── Usage in other modules ────────────────────────────────────────────────────
 *   @Module({ imports: [CommunicationsModule] })
 *   export class NotificationsModule {}
 *
 *   constructor(private readonly email: EmailService) {}
 *
 *   await this.email.send(EmailTemplates.welcome(params), user.email)
 */
@Module({
  imports: [ConfigModule],
  controllers: [CommunicationsController, WhatsAppBroadcastController],
  providers: [
    // ── Email providers (all registered; EmailService selects via env var)
    ResendProvider,
    SmtpProvider,
    SendGridProvider,
    MailgunProvider,

    // ── SMS / WhatsApp providers
    Fast2SMSProvider,
    BaileysProvider,
    MetaCloudApiProvider,

    // ── Provider-agnostic service layer
    EmailService,
    SMSService,
    WhatsAppService,
    WhatsAppBroadcastService,
  ],
  exports: [
    EmailService,
    SMSService,
    WhatsAppService,
    WhatsAppBroadcastService,
  ],
})
export class CommunicationsModule {}
