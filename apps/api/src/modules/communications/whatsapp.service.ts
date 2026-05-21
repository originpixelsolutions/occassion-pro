import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  IWhatsAppProvider,
  SendWADocumentOptions,
  SendWAMessageOptions,
  SendWAResult,
  SendWATemplateOptions,
  WhatsAppConnectionStatus,
} from './interfaces/whatsapp-provider.interface'
import { BaileysProvider } from './providers/baileys.provider'
import { MetaCloudApiProvider } from './providers/meta-cloud-api.provider'
import { SMSService } from './sms.service'

/**
 * WhatsAppService — provider-agnostic wrapper with SMS fallback.
 *
 * Provider selection via WHATSAPP_PROVIDER env var:
 *   meta    — Meta Cloud API (recommended for production; no QR, no session mgmt)
 *   baileys — Baileys self-hosted (legacy; requires QR pairing + persistent process)
 *
 * SMS fallback:
 *   Set WHATSAPP_SMS_FALLBACK=true to automatically fall back to SMS when
 *   a WhatsApp message fails to deliver. The SMS will contain the same text body.
 *
 * Usage:
 *   whatsappService.sendMessage({ to: '919876543210', message: 'Hello' })
 *   whatsappService.sendTemplate({ to: '+919876543210', template: 'event_invite', params: ['Priya'] })
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)
  private readonly provider: IWhatsAppProvider
  private readonly smsEnabled: boolean

  constructor(
    private readonly config:   ConfigService,
    private readonly baileys:  BaileysProvider,
    private readonly metaApi:  MetaCloudApiProvider,
    private readonly sms:      SMSService,
  ) {
    const providerName = config.get<string>('WHATSAPP_PROVIDER') ?? 'meta'
    this.smsEnabled    = config.get<string>('WHATSAPP_SMS_FALLBACK') === 'true'

    switch (providerName) {
      case 'meta':
        this.provider = this.metaApi
        this.logger.log('WhatsApp provider: Meta Cloud API')
        break
      case 'baileys':
        this.provider = this.baileys
        this.logger.log('WhatsApp provider: Baileys (legacy)')
        break
      default:
        this.logger.warn(`Unknown WHATSAPP_PROVIDER="${providerName}" — falling back to Meta Cloud API`)
        this.provider = this.metaApi
        break
    }
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────

  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    return this.provider.getConnectionStatus()
  }

  async connect(): Promise<void> {
    return this.provider.connect()
  }

  async disconnect(): Promise<void> {
    return this.provider.disconnect()
  }

  // ── Messaging ────────────────────────────────────────────────────────────

  /**
   * Send a plain-text WhatsApp message.
   * Falls back to SMS if WHATSAPP_SMS_FALLBACK=true and delivery fails.
   */
  async sendMessage(options: SendWAMessageOptions): Promise<SendWAResult> {
    const result = await this.provider.sendMessage(options)
    if (!result.success && this.smsEnabled) {
      return this.fallbackToSMS(options.to, options.message)
    }
    return result
  }

  /**
   * Send a WhatsApp template message.
   * Falls back to SMS (with interpolated text) if delivery fails.
   */
  async sendTemplate(options: SendWATemplateOptions): Promise<SendWAResult> {
    const result = await this.provider.sendTemplate(options)
    if (!result.success && this.smsEnabled) {
      // Build a plain-text fallback by interpolating params into the template string
      const text = this.interpolate(options.template, options.params)
      return this.fallbackToSMS(options.to, text)
    }
    return result
  }

  /** Send a document/file via WhatsApp. */
  async sendDocument(options: SendWADocumentOptions): Promise<SendWAResult> {
    return this.provider.sendDocument(options)
  }

  // ── Fire-and-forget helpers ──────────────────────────────────────────────

  /**
   * Fire-and-forget plain message — logs errors, never throws.
   */
  async sendAsync(options: SendWAMessageOptions): Promise<void> {
    this.sendMessage(options).then(result => {
      if (!result.success) this.logger.warn(`Async WA send failed: ${result.error}`)
    }).catch(err => this.logger.error(`Async WA error: ${err.message}`))
  }

  /**
   * Fire-and-forget template — logs errors, never throws.
   */
  async sendTemplateAsync(options: SendWATemplateOptions): Promise<void> {
    this.sendTemplate(options).then(result => {
      if (!result.success) this.logger.warn(`Async WA template failed: ${result.error}`)
    }).catch(err => this.logger.error(`Async WA template error: ${err.message}`))
  }

  // ── SMS Fallback ─────────────────────────────────────────────────────────

  /**
   * Send the message via SMS as a fallback.
   * Logs that WhatsApp delivery failed and SMS was used.
   */
  private async fallbackToSMS(to: string, message: string): Promise<SendWAResult> {
    this.logger.warn(`WhatsApp delivery failed — falling back to SMS for ${to}`)
    try {
      await this.sms.sendSMS({ to, message })
      return { success: true, messageId: `sms-fallback-${Date.now()}` }
    } catch (err: any) {
      this.logger.error(`SMS fallback also failed for ${to}: ${err.message}`)
      return { success: false, error: `WA and SMS both failed: ${err.message}` }
    }
  }

  /** Simple {{0}}, {{1}} interpolation for template SMS fallback */
  private interpolate(template: string, params: string[]): string {
    return params.reduce((t, p, i) => t.replace(`{{${i}}}`, p), template)
  }
}
