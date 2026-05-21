import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  IWhatsAppProvider,
  SendWADocumentOptions,
  SendWAMessageOptions,
  SendWAResult,
  SendWATemplateOptions,
  WhatsAppConnectionStatus,
} from '../interfaces/whatsapp-provider.interface'

/**
 * Meta Cloud API WhatsApp provider.
 *
 * Replaces the Baileys (self-hosted) provider with Meta's official Cloud API.
 * - No QR code pairing, no persistent socket connection.
 * - HTTP-only — one POST per message to the Graph API.
 * - Supports: text messages, approved template messages, document uploads.
 *
 * Required environment variables:
 *   META_WA_PHONE_NUMBER_ID   — from Meta Business → WhatsApp → API Setup
 *   META_WA_ACCESS_TOKEN      — long-lived System User token (not page token)
 *   META_WA_API_VERSION       — optional, default v19.0
 *
 * Optional:
 *   META_WA_VERIFY_TOKEN      — used to verify the webhook subscription (any string)
 *
 * Rate limits:
 *   - Tier 1 (new): 1,000 messages/24h; increases with message quality.
 *   - Template messages are subject to conversation-based pricing.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */
@Injectable()
export class MetaCloudApiProvider implements IWhatsAppProvider {
  private readonly logger = new Logger(MetaCloudApiProvider.name)
  private readonly phoneNumberId: string
  private readonly accessToken: string
  private readonly apiVersion: string
  private readonly baseUrl: string

  constructor(private readonly config: ConfigService) {
    this.phoneNumberId = config.get<string>('META_WA_PHONE_NUMBER_ID') ?? ''
    this.accessToken   = config.get<string>('META_WA_ACCESS_TOKEN') ?? ''
    this.apiVersion    = config.get<string>('META_WA_API_VERSION') ?? 'v19.0'
    this.baseUrl       = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`
  }

  // ── Connection lifecycle (not needed for HTTP provider) ──────────────────

  async connect(): Promise<void> {
    // Meta Cloud API is always "connected" — no persistent session needed.
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'META_WA_PHONE_NUMBER_ID or META_WA_ACCESS_TOKEN not configured. '
        + 'WhatsApp messages will fail.'
      )
    } else {
      this.logger.log(`Meta Cloud API WhatsApp provider ready (phone ID: ${this.phoneNumberId})`)
    }
  }

  async disconnect(): Promise<void> {
    // No-op — no session to clear.
  }

  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    const configured = Boolean(this.phoneNumberId && this.accessToken)
    return {
      status: configured ? 'connected' : 'disconnected',
      phone:  this.phoneNumberId || undefined,
      lastConnected: configured ? new Date() : undefined,
    }
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  /**
   * Send a free-form text message.
   * NOTE: Only deliverable within the 24-hour customer service window
   * (i.e. after the recipient has messaged the business first).
   * For proactive outreach, use sendTemplate() with an approved template.
   */
  async sendMessage(options: SendWAMessageOptions): Promise<SendWAResult> {
    const body = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to:                this.normalizePhone(options.to),
      type:              'text',
      text:              { body: options.message, preview_url: false },
    }
    return this.post('/messages', body)
  }

  /**
   * Send a Meta-approved template message.
   *
   * options.template  — template name as registered in WhatsApp Business Manager
   * options.params    — positional body parameters: ['John', 'OP-2024-001', ...]
   *
   * Language defaults to 'en' unless options.language is provided (via params[last]).
   *
   * Example usage:
   *   sendTemplate({
   *     to: '919876543210',
   *     template: 'event_invitation',
   *     params: ['Priya', 'Grand Wedding', '15 June 2025', 'Taj Palace, Delhi']
   *   })
   */
  async sendTemplate(options: SendWATemplateOptions): Promise<SendWAResult> {
    const components: object[] = []

    if (options.params.length > 0) {
      components.push({
        type:       'body',
        parameters: options.params.map(p => ({ type: 'text', text: p })),
      })
    }

    const body = {
      messaging_product: 'whatsapp',
      to:                this.normalizePhone(options.to),
      type:              'template',
      template: {
        name:     options.template,
        language: { code: 'en' },
        ...(components.length > 0 ? { components } : {}),
      },
    }
    return this.post('/messages', body)
  }

  /**
   * Send a document via WhatsApp.
   * Uploads the buffer as a media object first, then sends the media message.
   *
   * Meta Cloud API requires a two-step process for binary uploads:
   * 1. POST /media → get media_id
   * 2. POST /messages with { type: 'document', document: { id: media_id } }
   */
  async sendDocument(options: SendWADocumentOptions): Promise<SendWAResult> {
    // Step 1: Upload media
    const mediaId = await this.uploadMedia(options.buffer, options.mimeType ?? 'application/pdf', options.filename)
    if (!mediaId) {
      return { success: false, error: 'Failed to upload document to Meta Cloud API' }
    }

    // Step 2: Send document message
    const body = {
      messaging_product: 'whatsapp',
      to:                this.normalizePhone(options.to),
      type:              'document',
      document: {
        id:       mediaId,
        filename: options.filename,
        ...(options.caption ? { caption: options.caption } : {}),
      },
    }
    return this.post('/messages', body)
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * POST to the Graph API and map the response to SendWAResult.
   */
  private async post(path: string, body: object): Promise<SendWAResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      return { success: false, error: 'Meta Cloud API not configured (missing credentials)' }
    }

    const url = `${this.baseUrl}${path}`
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await res.json() as any

      if (!res.ok) {
        const errMsg = data?.error?.message ?? `HTTP ${res.status}`
        this.logger.error(`Meta WhatsApp API error [${res.status}]: ${errMsg}`)
        return { success: false, error: errMsg }
      }

      const messageId = data?.messages?.[0]?.id
      return { success: true, messageId }

    } catch (err: any) {
      this.logger.error(`Meta Cloud API fetch failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  /**
   * Upload binary buffer to Meta media endpoint.
   * Returns media_id on success, null on failure.
   */
  private async uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
    if (!this.accessToken || !this.phoneNumberId) return null

    const url = `${this.baseUrl}/media`
    try {
      // Build a multipart/form-data body manually using Node FormData
      const formData = new FormData()
      const blob     = new Blob([buffer], { type: mimeType })
      formData.append('file',              blob, filename)
      formData.append('type',              mimeType)
      formData.append('messaging_product', 'whatsapp')

      const res  = await fetch(url, {
        method:  'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body:    formData,
      })
      const data = await res.json() as any
      if (!res.ok) {
        this.logger.error(`Media upload failed [${res.status}]: ${data?.error?.message}`)
        return null
      }
      return data.id ?? null

    } catch (err: any) {
      this.logger.error(`Media upload error: ${err.message}`)
      return null
    }
  }

  /**
   * Normalize phone number to E.164 without the '+'.
   * Meta Cloud API expects numbers like "919876543210" (no + prefix).
   */
  private normalizePhone(phone: string): string {
    // Strip all non-digits
    const digits = phone.replace(/\D/g, '')
    // If 10-digit Indian number, prepend 91
    if (digits.length === 10) return `91${digits}`
    return digits
  }
}
