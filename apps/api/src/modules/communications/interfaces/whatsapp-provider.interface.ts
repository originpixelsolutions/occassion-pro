export interface SendWAMessageOptions {
  to: string   // phone number with country code, e.g. 919876543210
  message: string
}

export interface SendWATemplateOptions {
  to: string
  template: string
  params: string[]
}

export interface SendWADocumentOptions {
  to: string
  buffer: Buffer
  filename: string
  caption?: string
  mimeType?: string
}

export interface SendWAResult {
  success: boolean
  messageId?: string
  error?: string
}

export type WhatsAppStatus = 'connected' | 'connecting' | 'qr_pending' | 'disconnected'

export interface WhatsAppConnectionStatus {
  status: WhatsAppStatus
  qr?: string            // base64 QR code image when status = qr_pending
  phone?: string         // connected phone number
  lastConnected?: Date
}

export interface IWhatsAppProvider {
  sendMessage(options: SendWAMessageOptions): Promise<SendWAResult>
  sendTemplate(options: SendWATemplateOptions): Promise<SendWAResult>
  sendDocument(options: SendWADocumentOptions): Promise<SendWAResult>
  getConnectionStatus(): Promise<WhatsAppConnectionStatus>
  connect(): Promise<void>
  disconnect(): Promise<void>
}

export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER'
