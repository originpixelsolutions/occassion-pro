import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as path from 'path'
import * as fs from 'fs'
import {
  IWhatsAppProvider,
  SendWADocumentOptions,
  SendWAMessageOptions,
  SendWAResult,
  SendWATemplateOptions,
  WhatsAppConnectionStatus,
} from '../interfaces/whatsapp-provider.interface'

/**
 * Baileys WhatsApp provider — free, self-hosted via @whiskeysockets/baileys.
 *
 * Session files are stored in ./baileys-session/ relative to CWD.
 * QR code is generated on first connect and re-generated on session expiry.
 *
 * Install: pnpm add @whiskeysockets/baileys qrcode
 *
 * NOTE: Baileys uses dynamic require for some internals; types may need
 * `"esModuleInterop": true` and `"allowSyntheticDefaultImports": true` in tsconfig.
 */
@Injectable()
export class BaileysProvider implements IWhatsAppProvider, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysProvider.name)
  private readonly sessionDir: string

  // Lazily loaded Baileys instance
  // Typed as any to avoid hard compile dependency on @whiskeysockets/baileys
  private sock: any = null
  private qrCode: string | null = null
  private status: 'connected' | 'connecting' | 'qr_pending' | 'disconnected' = 'disconnected'
  private connectedPhone: string | null = null
  private lastConnected: Date | null = null

  constructor(private readonly config: ConfigService) {
    this.sessionDir = config.get<string>('BAILEYS_SESSION_DIR')
      ?? path.join(process.cwd(), 'baileys-session')
  }

  async onModuleInit() {
    if (this.config.get('WHATSAPP_PROVIDER') === 'baileys') {
      // Attempt to reconnect if session files already exist
      if (fs.existsSync(this.sessionDir)) {
        this.logger.log('Existing Baileys session found — attempting reconnect')
        await this.connect().catch(err => {
          this.logger.warn(`Auto-reconnect failed: ${err.message}`)
        })
      }
    }
  }

  async onModuleDestroy() {
    await this.safeDisconnect()
  }

  async connect(): Promise<void> {
    try {
      // Dynamic import to avoid hard compile-time dependency
      // If @whiskeysockets/baileys is not installed, log warning and bail
      let baileys: any
      try {
        baileys = await import('@whiskeysockets/baileys')
      } catch {
        this.logger.error(
          '@whiskeysockets/baileys is not installed. Run: pnpm add @whiskeysockets/baileys'
        )
        this.status = 'disconnected'
        return
      }

      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true })
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir)

      this.status = 'connecting'
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['OccasionPro', 'Chrome', '1.0.0'],
        logger: { level: 'silent' } as any,
      })

      this.sock.ev.on('creds.update', saveCreds)

      this.sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          this.logger.log('WhatsApp QR code generated — scan to connect')
          this.qrCode = qr
          this.status = 'qr_pending'
          // Also try to generate a base64 PNG version
          this.generateQRBase64(qr).catch(() => {})
        }

        if (connection === 'close') {
          const shouldReconnect =
            lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
          this.logger.warn(`WhatsApp connection closed. Reconnect: ${shouldReconnect}`)
          this.status = 'disconnected'
          this.sock = null
          if (shouldReconnect) {
            setTimeout(() => {
              this.connect().catch(e => this.logger.error(`Reconnect failed: ${e.message}`))
            }, 5000)
          }
        }

        if (connection === 'open') {
          this.logger.log('WhatsApp connected successfully')
          this.status = 'connected'
          this.qrCode = null
          this.lastConnected = new Date()
          this.connectedPhone = this.sock.user?.id?.split(':')[0] ?? null
        }
      })

    } catch (err: any) {
      this.logger.error(`Baileys connect failed: ${err.message}`)
      this.status = 'disconnected'
    }
  }

  private async generateQRBase64(qrData: string): Promise<void> {
    try {
      const qrcode = await import('qrcode')
      const dataUrl = await qrcode.default.toDataURL(qrData)
      // Store the data URL (already base64 encoded as data:image/png;base64,...)
      this.qrCode = dataUrl
    } catch {
      // qrcode package not installed — store raw QR string
    }
  }

  async disconnect(): Promise<void> {
    await this.safeDisconnect()
    // Clear session files to force fresh QR on next connect
    if (fs.existsSync(this.sessionDir)) {
      fs.rmSync(this.sessionDir, { recursive: true, force: true })
    }
    this.status = 'disconnected'
    this.connectedPhone = null
    this.qrCode = null
    this.logger.log('WhatsApp disconnected and session cleared')
  }

  private async safeDisconnect(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout()
      } catch {
        try { this.sock.end(undefined) } catch { /* ignore */ }
      }
      this.sock = null
    }
  }

  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    return {
      status: this.status,
      qr: this.qrCode ?? undefined,
      phone: this.connectedPhone ?? undefined,
      lastConnected: this.lastConnected ?? undefined,
    }
  }

  async sendMessage(options: SendWAMessageOptions): Promise<SendWAResult> {
    if (!this.sock || this.status !== 'connected') {
      return { success: false, error: 'WhatsApp not connected' }
    }
    try {
      const jid = this.toJID(options.to)
      const result = await this.sock.sendMessage(jid, { text: options.message })
      return { success: true, messageId: result?.key?.id }
    } catch (err: any) {
      this.logger.error(`WhatsApp sendMessage failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  async sendTemplate(options: SendWATemplateOptions): Promise<SendWAResult> {
    // For Baileys (non-Business API), templates are just pre-formatted messages
    const message = this.interpolate(options.template, options.params)
    return this.sendMessage({ to: options.to, message })
  }

  async sendDocument(options: SendWADocumentOptions): Promise<SendWAResult> {
    if (!this.sock || this.status !== 'connected') {
      return { success: false, error: 'WhatsApp not connected' }
    }
    try {
      const jid = this.toJID(options.to)
      const result = await this.sock.sendMessage(jid, {
        document: options.buffer,
        fileName: options.filename,
        mimetype: options.mimeType ?? 'application/octet-stream',
        caption: options.caption,
      })
      return { success: true, messageId: result?.key?.id }
    } catch (err: any) {
      this.logger.error(`WhatsApp sendDocument failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  /** Convert phone number to WhatsApp JID */
  private toJID(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    // If 10-digit Indian number, prefix with 91
    const full = digits.length === 10 ? `91${digits}` : digits
    return `${full}@s.whatsapp.net`
  }

  /** Replace {{0}}, {{1}}, etc. with params */
  private interpolate(template: string, params: string[]): string {
    return params.reduce((t, p, i) => t.replace(`{{${i}}}`, p), template)
  }
}
